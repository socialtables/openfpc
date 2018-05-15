/* eslint-disable no-use-before-define */
const debug = require("debug")("openfpc:floor-geometry:room-traversal");
const { Vector2, Box2 } = require("three");
const { interpolateArcPointsByConstraints, computeArcRadius, computeChordLengthFromRadiusAndAngle } = require("./arcs");
const EnclosureTree = require("./enclosure-tree");

// three.js is only in here for its nice math interfaces -- can be removed
// to reduce dependency bloat if someone has time to go in and re-work the
// relevant methods for Vector2 and Box2

const DEBUG_QUIETLY = 1; // flip this to 0 when making changes
const MAX_ANCESTOR_CHAIN_LEN = 10000;
const MAX_POINT_BOUND_HOPS = 200;
const ARC_OVERLAP_ERROR_THRESHOLD = Math.PI / 4;

// this is configurable
var ARC_INTERPOLATION_PRECISION = Math.PI / 32;

module.exports = {
  resolveRooms, // room tracing for floors
  combineRooms, // room merges for bookable rooms
  setArcInterpolationPrecision // arc precision setter
};

/**
 * Room resolution for V4 data -- classifies either all boundaries in
 * simpleFloor into rooms. Rooms have sequentially assigned IDs, and should
 * be re-labeled using room-association to avoid breaking bookable rooms.
 * @param floor: a simple V4 floor
 * @return: an array of simple V4 rooms
 */
function resolveRooms(simpleFloor) {

  // ingest data
  const [bounds] = _ingestSimpleFloorSrcData(simpleFloor.data.points, simpleFloor.data.boundaries);

  // trace all boundaries to identify cycles
  const cycles = _findBoundaryCycles(bounds);
  DEBUG_QUIETLY || debug("finished cycle resolution");

  // build a tree from the resolved cycles, constructing a room hierarchy in
  // the process
  const [encTree, cyclesByID] = _constructCycleEnclosureTree(cycles);
  DEBUG_QUIETLY || debug("finished enclosure tree");

  // now, use the structure of the tree to figure out what contains what,
  // assigning parents and hole geometry along the way
  _assignHolesAndParents(encTree, cyclesByID);
  DEBUG_QUIETLY || debug("finished traversing enclosure tree");

  // figure out where all the free-floating stuff belongs
  _assignInteriorBoundariesToCycles(encTree, cycles, cyclesByID, bounds);
  DEBUG_QUIETLY || debug("finished interior bound assignent...");

  // convert cycles to room data
  let roomID = 1;
  const rooms = cycles.map(cycle => cycle.room = {
    id: roomID++,
    boundaries: {
      perimeter: cycle.boundaries.map(b => b.id),
      holes: cycle.holes.map(h => h.map(b => b.id)),
      interior: cycle.interiorBoundaries.map(b => b.id)
    },
    parent_id: null
  });

  // relabel enclosure tree for use in object room resolution
  encTree.traverseDown((cycleID, _, depth, mutator) => mutator(null, cyclesByID[cycleID].room.id));

  // stitch room parent IDs
  cycles.forEach(cycle => {
    if (cycle.parent) {
      cycle.room.parent_id = cycle.parent.room.id;
    }
  });

  // return resolved rooms and enclosure tree
  return [rooms, encTree];
}

/**
 * Combines the supplied rooms into a set of regions, which comprise the
 * renderable area of a bookable room.
 *
 * which can (and will) include nesting
 * @param simpleFloor: simple V4 floor data with points and boundaries
 * @param rooms: rooms to combine
 * @returns: [combined regions, enclosure tree]
 */
function combineRooms (simpleFloor, rooms) {

  // all boundary groups + interior boundary IDs from rooms
  const allGroups = [];
  const interiorBoundIDSet = {};

  // objects shared by boundary groups
  const boundToGroup = {};
  const boundRefCounts = {};

  // for each room, add its perimeter and holes to a new boundary group,
  // which also triggers a merge/exclude for connected groups with duped
  // boundaries.
  rooms.forEach(room => {
    [room.boundaries.perimeter]
    .concat(room.boundaries.holes)
    .forEach(boundLoop => {
      allGroups.push(
        new _BoundaryGroup(boundToGroup, boundRefCounts).ingest(boundLoop)
      );
    });
    room.boundaries.interior.forEach(boundID => interiorBoundIDSet[boundID] = 1);
  });

  // convert boundary groups into the final set of traversable boundaries
  const finalGroups = allGroups.filter(g => !g.shouldBeSkipped);

  // dump bounds with multiple references into the interior boundary ID set
  Object.keys(boundRefCounts)
  .filter(id => (boundRefCounts[id] > 1))
  .forEach(id => interiorBoundIDSet[id] = 1);

  // ingest floor data
  const [singleRefBounds] = _ingestSimpleFloorSrcData(
    simpleFloor.data.points,
    simpleFloor.data.boundaries.filter(b => boundRefCounts[b.id] === 1)
  );
  const [interiorBounds] = _ingestSimpleFloorSrcData(
    simpleFloor.data.points,
    simpleFloor.data.boundaries.filter(b => interiorBoundIDSet[b.id])
  );

  // do cycle tracing on each boundary group independantly, but combine
  // the resulting cycle arrays in a single enclosure tree
  let finalCycles = [];
  finalGroups.forEach(boundGroup => {
    const groupBounds = singleRefBounds.filter(b => boundGroup.boundSet[b.id]);
    const groupCycles = _findBoundaryCycles(groupBounds);
    finalCycles.push(...groupCycles);
  });
  const [encTree, cyclesByID] = _constructCycleEnclosureTree(finalCycles);

  // assign holes, interior boundaries
  _assignHolesAndParents(encTree, cyclesByID);
  _assignInteriorBoundariesToCycles(encTree, finalCycles, cyclesByID, interiorBounds);

  // get ready to skip every other cycle, as it'll be a hole
  const skipCycles = {};
  encTree.traverseDown((cid, pcid, depth, mutator) => {
    if (depth % 2) {
      skipCycles[cid] = 1;
      mutator(true);
    }
  });

  // convert cycles to flat regions for output
  const finalRegions = Object.keys(cyclesByID)
  .filter(id => !skipCycles[id])
  .map(id => cyclesByID[id])
  .map(cycle => ({
    id: cycle.id, // re-use cycle IDs produced during tree construction
    boundaries: {
      perimeter: cycle.boundaries.map(b => b.id),
      holes:     cycle.holes.map(h => h.map(b => b.id)),
      interior:  cycle.interiorBoundaries.map(b => b.id)
    }
  }));
  return [finalRegions, encTree];
}

/**
 * Internal helper for finding cycles of boundaries in a given floor.
 * Works by tracing loops around contiguous boundaries, identifying and skipping
 * boundaries that have the same trace on both sides, and making the rest into
 * cycles. Each trace produces an outermost exterior cycle, which is eliminated.
 * @param points: ingested points
 * @param bounds: ingested boundaries
 * @return: the traced cycles.
 */
function _findBoundaryCycles(bounds) {

  DEBUG_QUIETLY || debug("starting boundary tracing");

  const unfilteredCycles = [];
  for (let sbi = 0; sbi < bounds.length; sbi++) {
    const startBound = bounds[sbi];

    // trace around left, right parts of the boundary
    if (!startBound.marked && !startBound.leftCycle) {
      DEBUG_QUIETLY || debug("tracing from left", startBound.id);
      unfilteredCycles.push(..._traceBounds(startBound, true));
    }
    if (!startBound.marked && !startBound.rightCycle) {
      DEBUG_QUIETLY || debug("tracing from right", startBound.id);
      unfilteredCycles.push(..._traceBounds(startBound, false));
    }
  }

  DEBUG_QUIETLY || debug("finished boundary tracing");

  // great, all our boundaries should be labled into cycles or marked
  // and we have a bunch of cycles -- time to find groups and remove
  // the perimeter wrapper around each!

  const cycleGroups = [];
  for (let csi = 0; csi < unfilteredCycles.length; csi++) {
    const cycle = unfilteredCycles[csi];
    if (cycle.marked) {
      DEBUG_QUIETLY || debug("skipped marked cycle");
      continue;
    }
    _unmarkBoundaries(bounds); // could just un-mark a subset...
    const cycleGroup = [];
    const startBound = cycle.boundaries[0];
    startBound.marked = true;
    const frontier = [startBound];
    let it = 0;
    while (frontier.length) {
      if (it++ > MAX_ANCESTOR_CHAIN_LEN) {
        throw new Error("too many iterations");
      }
      const bound = frontier.pop();
      if (!bound.leftCycle && !bound.rightCycle) {
        continue;
      }
      const boundLeftCycle = bound.leftCycle;
      const boundRightCycle = bound.rightCycle;
      if (boundLeftCycle && !boundLeftCycle.marked) {
        boundLeftCycle.marked = true;
        cycleGroup.push(boundLeftCycle);
      }
      if (boundRightCycle && !boundRightCycle.marked) {
        boundRightCycle.marked = true;
        cycleGroup.push(boundRightCycle);
      }
      for (let pbi = 0; pbi < bound.start.boundaries.length; pbi++) {
        const pBound = bound.start.boundaries[pbi];
        if (pBound.marked) {
          continue;
        }
        pBound.marked = true;
        frontier.push(pBound);
      }
      for (let pbi = 0; pbi < bound.end.boundaries.length; pbi++) {
        const pBound = bound.end.boundaries[pbi];
        if (pBound.marked) {
          continue;
        }
        pBound.marked = true;
        frontier.push(pBound);
      }
    }
    cycleGroups.push(cycleGroup);
  }

  DEBUG_QUIETLY || debug("finished initial trace, %s cycle groups", cycleGroups.length);

  const finalCycles = [];
  for (let cgi = 0; cgi < cycleGroups.length; cgi++) {
    const cycleGroup = cycleGroups[cgi];
    let largestBBoxSize = 0;
    let largestArea = 0;
    let largestCycle = null;
    for (let ci = 0; ci < cycleGroup.length; ci++) {
      const cycle = cycleGroup[ci];
      const cycleBBox = new Box2();
      for (let bi = 0; bi < cycle.boundaries.length; bi++) {
        const bound = cycle.boundaries[bi];
        cycleBBox.expandByPoint(bound.start);
        cycleBBox.expandByPoint(bound.end);
      }
      const cycleBBoxSize = cycleBBox.max.clone().sub(cycleBBox.min).length();
      const cycleArea = _getCycleArea(cycle);
      if (
        (cycleBBoxSize >= largestBBoxSize) &&
				(cycleArea >= largestArea)
      ) {
        if (
          (cycleBBoxSize === largestBBoxSize) &&
          (cycle.boundaries.length < largestCycle.boundaries.length)
        ) {
          continue;
        }
        largestBBoxSize = cycleBBoxSize;
        largestArea = cycleArea;
        largestCycle = cycle;
      }
    }
    DEBUG_QUIETLY || debug("traced section %s len, removing %s", cycleGroup.length, largestCycle.id);
    for (let ci = 0; ci < cycleGroup.length; ci++) {
      const cycle = cycleGroup[ci];
      if (cycle !== largestCycle) {
        finalCycles.push(cycle);
        cycle.boundaryDirections = _resolveBoundaryDirections(cycle.boundaries);
        cycle.makeCCW();
        cycle.perimeterCycle = largestCycle; // reuse this for holes
      }
      else { // make perimeter CCW
        cycle.boundaryDirections = _resolveBoundaryDirections(cycle.boundaries);
        cycle.makeCCW();
      }
    }
  }

  return finalCycles;
}

/**
 * Converts a supplied floor source into points and boundaries ready suitable
 * for high-speed traversal. Will drop duplicate boundaries that share the
 * same points and arc height (but still handle taco-shaped rooms).
 *
 * @param srcPoints: an array of simple V4 floor data points
 * @param srcBounds: an array of simple V4 floor data boundaries
 * @return: an array that contains the supplied points, boundaries,
 *          points by ID, and boundaries by ID
 */
function _ingestSimpleFloorSrcData(srcPoints, srcBoundaries) {

  const points = [];
  const boundaries = [];

  const pointsByID = {};
  const boundariesByID = {};

  // build points
  for (let pi = 0; pi < srcPoints.length; pi++) {
    const srcPoint = srcPoints[pi];
    const point = new _Point(srcPoint.x, srcPoint.y, srcPoint.id);
    points.push(point);
    pointsByID[point.id] = point;
  }

  // build boundaries and associate them with points
  for (let bi = 0; bi < srcBoundaries.length; bi++) {
    const srcBound = srcBoundaries[bi];

    // avoid zero-length bounds like the plague
    if (srcBound.start === srcBound.end) {
      DEBUG_QUIETLY || debug(
        "found bound with same start and end, skipping",
        srcBound.id
      );
      continue;
    }

    const startPoint = pointsByID[srcBound.start];
    const endPoint = pointsByID[srcBound.end];
    const bound = new _Boundary(srcBound, startPoint, endPoint);

    // make sure we don't add any duplicate boundaries that could
    // lead to broken cycle handling code!
    const spBounds = startPoint.boundaries;
    let isDuplicate = false;
    for (let pbi=0; pbi < spBounds.length; pbi++) {
      const spBound = spBounds[pbi];
      if (spBound.containsPoint(endPoint)) {
        isDuplicate = spBound.arc === bound.arc;
        break;
      }
    }
    if (isDuplicate) {
      continue;
    }

    boundaries.push(bound);
    boundariesByID[bound.id] = bound;
    startPoint.boundaries.push(bound);
    endPoint.boundaries.push(bound);
  }

  // sort point boundary arrays for traversal
  for (let pi = 0; pi < points.length; pi++) {
    const point = points[pi];
    _sortPointBoundariesCCW(point);
  }

  return [
    // We only actually use boundaries currently, return first to allow
    // for single-argument destructuring that won't trigger eslint unused
    // variable warnings.
    boundaries,
    points,
    boundariesByID,
    pointsByID
  ];
}

// Storage classes for traversal data - the theory is that re-referencing
// these will be less expensive then storing large maps of secondary object
// properties

/**
 * Internal point representation with adjacent boundaries, marked state
 */
function _Point (x, y, srcID) {
  Vector2.call(this, x, y);
  this.id = srcID;
  this.marked = false;
  this.ancestor = null;
  this.ancestorBoundary = null;
  this.boundaries = [];
}
_Point.prototype = Object.create( Vector2.prototype );
_Point.prototype.constructor = _Point;
_Point.prototype.boundToLeft = function(boundIn) {
  if (this.boundaries.length === 1) {
    return boundIn;
  }
  for (let bi = 0; bi < this.boundaries.length; bi++) {
    const bound = this.boundaries[bi];
    if (bound === boundIn) {
      return this.boundaries[(this.boundaries.length + bi - 1) % this.boundaries.length];
    }
  }
  throw new Error("no left boundary somehow");
};

/**
 * Internal boundary representation with adjacent boundaries, marked state
 */
function _Boundary (src, start, end) {
  this.id = src.id;
  this.arc = src.arc || 0;
  this._arcOffsetAngle = 0;
  this.start = start;
  this.end = end;
  this.leftCycle = null;
  this.rightCycle = null;
  this.angle = 0;
  this.rawAngle = 0;
  this.marked = false;
}
_Boundary.prototype = {
  constructor: _Boundary,
  getOtherPoint (pnt) {
    return (this.start === pnt) ? this.end : this.start;
  },
  containsPoint(pnt) {
    return (this.start === pnt) || (this.end === pnt);
  },
  get relativeOffsetAngle() {
    if ((!this.arc) || this._arcOffsetAngle) {
      return this._arcOffsetAngle;
    }
    const chordLength = this.end.clone().sub(this.start).length();
    const arcHeight = this.arc;
    const arcRadius = (( arcHeight * arcHeight ) + (chordLength * chordLength / 4)) / (2 * arcHeight);
    this._arcOffsetAngle = Math.acos(1 - (arcHeight / arcRadius)) * ((arcHeight > 0) ? 1 : -1);
    return this._arcOffsetAngle;
  }
};

/**
 * Internal cycle representation
 */
var _cycleID = 1;
function _Cycle (boundaries) {
  this.boundaries = boundaries;
  this.boundaryDirections = _resolveBoundaryDirections(boundaries);
  this.marked = false;
  this.id = _cycleID++; // initial assiged ID used for logging only
  this.perimeterCycle = null;
  this.parent = null;
  this.holes = [];
  this.holeCycles = [];
  this.interiorBoundaries = [];
  this.finalRoom = null;
}
_Cycle.prototype = {
  constructor: _Cycle,
  makeCCW () {
    if (!_isCCW(this.boundaries)) {
      this.boundaries.reverse();
      for (let bi = 0; bi < this.boundaries.length; bi++) {
        const bound = this.boundaries[bi];
        this.boundaryDirections[bound.id] *= -1;
      }
    }
  }
};

/**
 * Traces one or more cycles by traversing around a given boundary
 * loop
 * @param startBound: first boundary to examine
 * @param startBoundForwards: whether the trace is aligned with cycle direction
 * @return: traced cycles
 */
const TMP_CYCLE = { id: "DEFAULT" };
function _traceBounds (startBound, startBoundForwards) {

  let boundStartPoint;
  if (startBoundForwards) {
    startBound.leftCycle = TMP_CYCLE;
    boundStartPoint = startBound.start;
  }
  else {
    startBound.rightCycle = TMP_CYCLE;
    boundStartPoint = startBound.end;
  }
  const tracedBounds = [];
  let prevBound = startBound;
  let nextPoint = startBound.getOtherPoint(boundStartPoint);
  let nextBound = nextPoint.boundToLeft(prevBound);

  tracedBounds.push(nextBound);
  let nextBoundForwards = (nextBound.start === nextPoint);
  if (nextBoundForwards) {
    nextBound.leftCycle = TMP_CYCLE;
  }
  else {
    nextBound.rightCycle = TMP_CYCLE;
  }

  let it = 0;
  while ((nextBound !== startBound) || (nextBoundForwards !== startBoundForwards)) {
    if (it++ > MAX_ANCESTOR_CHAIN_LEN) {
      throw new Error("too many iterations in cycle trace");
    }
    if (nextBoundForwards) {
      nextBound.leftCycle = TMP_CYCLE;
    }
    else {
      nextBound.rightCycle = TMP_CYCLE;
    }

    nextPoint = nextBound.getOtherPoint(nextPoint);
    nextBound = nextPoint.boundToLeft(nextBound);
    nextBoundForwards = (nextPoint === nextBound.start);
    tracedBounds.push(nextBound);
  }

  // now, trace cycles, potentially from each traced boundary
  const tracedCycles = [];
  for (let tbi = 0; tbi < tracedBounds.length; tbi++) {
    const traceStartBound = tracedBounds[tbi];

    if (traceStartBound.marked) {
      continue;
    }
    if (traceStartBound.leftCycle === traceStartBound.rightCycle) {
      traceStartBound.marked = true;
      traceStartBound.leftCycle = null;
      traceStartBound.rightCycle = null;
      continue;
    }
    const traceStartBoundForwards = (traceStartBound.leftCycle === TMP_CYCLE);

    const cycle = new _Cycle([traceStartBound]);
    traceStartBound.marked = true;
    if (traceStartBoundForwards) {
      traceStartBound.leftCycle = cycle;
    }
    else {
      traceStartBound.rightCycle = cycle;
    }
    let nextPoint = traceStartBoundForwards ? traceStartBound.end : traceStartBound.start;
    let nextBound = nextPoint.boundToLeft(traceStartBound);
    let it = 0;
    while (nextBound.leftCycle === nextBound.rightCycle) {
      if (nextBound.leftCycle === TMP_CYCLE) {
        nextBound.marked = true;
        nextBound.leftCycle = null;
        nextBound.rightCycle = null;
      }
      if (it++ > MAX_POINT_BOUND_HOPS) {
        debug("error while searching around point", nextPoint.id);
        throw new Error("too many point-boundary hops");
      }
      nextBound = nextPoint.boundToLeft(nextBound);
    }
    let nextBoundForwards = nextBound.leftCycle === TMP_CYCLE;
    it = 0;
    while ((nextBound !== traceStartBound) || (nextBoundForwards !== traceStartBoundForwards)) {
      if (it++ > MAX_ANCESTOR_CHAIN_LEN) {
        throw new Error("too many iterations in cycle trace");
      }
      cycle.boundaries.push(nextBound);
      nextBound.marked = true;
      if (nextBoundForwards) {
        nextBound.leftCycle = cycle;
      }
      else {
        nextBound.rightCycle = cycle;
      }
      nextPoint = nextBound.getOtherPoint(nextPoint);
      nextBound = nextPoint.boundToLeft(nextBound);
      let subIt = 0;
      while (nextBound.leftCycle === nextBound.rightCycle) {
        if (nextBound.leftCycle === TMP_CYCLE) {
          nextBound.marked = true;
          nextBound.leftCycle = null;
          nextBound.rightCycle = null;
        }
        if (subIt++ > MAX_POINT_BOUND_HOPS) {
          debug("error while searching around point", nextPoint.id);
          throw new Error("too many point-boundary hops");
        }
        nextBound = nextPoint.boundToLeft(nextBound);
      }
      nextBoundForwards = (nextPoint === nextBound.start);
    }
    DEBUG_QUIETLY || debug("traced cycle length = %s", cycle.boundaries.length);
    tracedCycles.push(cycle);
  }

  // un-mark boundaries from traced cycles to allow alternate-direction pass
  for (let ci = 0; ci < tracedCycles.length; ci++) {
    const cycle = tracedCycles[ci];
    for (let bi = 0; bi < cycle.boundaries.length; bi++) {
      const bound = cycle.boundaries[bi];
      bound.marked = false;
    }
  }

  DEBUG_QUIETLY || debug("traced to %s cycles", tracedCycles.length);
  return tracedCycles;
}

/**
 * Checks whether a given array of boundaries is cyclical
 * @param boundaryArr: an array of boundaries
 * @return true or valse
 */
function _isCCW (boundaryArr) {

  // degenerate case (aka taco-shaped room 🌮.) is both counter-clockwise and
  // clockwise, as the cyclical ordering of boundaries is dual.
  if (boundaryArr.length === 2) {
    return true;
  }

  DEBUG_QUIETLY || debug("boundary array length", boundaryArr.length);

  const firstBound = boundaryArr[0];
  const lastBound = boundaryArr[boundaryArr.length - 1];
  const firstBoundReversed = lastBound.containsPoint(firstBound.end);

  let sumTheta = 0;
  let midPoint = firstBoundReversed ? firstBound.end : firstBound.start;
  let prevPoint = lastBound.getOtherPoint(midPoint);
  let prevBound = lastBound;
  let prevBoundReversed = lastBound.end === prevPoint;
  for (let ai = 0; ai < boundaryArr.length; ai++) {

    // find next boundary and all that jazz
    const nextBound = boundaryArr[ai];
    const nextBoundReversed = nextBound.end === midPoint;
    const nextPoint = nextBoundReversed ? nextBound.start : nextBound.end;

    // figure out the angle between the three points
    const prevVect = midPoint.clone().sub(prevPoint); // expensive curry!
    const nextVect = nextPoint.clone().sub(midPoint);
    const prevNormal = new Vector2(-prevVect.y, prevVect.x);
    const dotProduct = nextVect.dot(prevVect);
    const crossProduct = nextVect.dot(prevNormal);
    let theta = new Vector2(dotProduct, crossProduct).angle();
    if (theta > Math.PI) {
      theta -= Math.PI * 2;
    }

    // figure out the relative arc offsets of both boundaries
    const prevArcTheta = prevBound.relativeOffsetAngle * (prevBoundReversed ? -1 : 1);
    const nextArcTheta = nextBound.relativeOffsetAngle * (nextBoundReversed ? -1 : 1);

    // resolve aggregate angle
    let combinedTheta = theta + prevArcTheta + nextArcTheta;
    if (combinedTheta > Math.PI) {
      combinedTheta -= 2 * Math.PI;
    }
    else if (combinedTheta < -Math.PI) {
      combinedTheta += 2 * Math.PI;
    }

    // add offset, subtract delta due to arc curvature
    sumTheta += combinedTheta - (prevArcTheta * 2);

    // bump next to previous for next iteration
    prevBound = nextBound;
    prevPoint = midPoint;
    midPoint = nextPoint;
    prevBoundReversed = nextBoundReversed;
  }

  DEBUG_QUIETLY || debug("cycle winding sum", sumTheta);

  // if the total winding was positive (should be close to 2 PI), we're CCW
  return sumTheta > 0;
}

/**
 * Produces a map from boundary ID to direction (1 or -1) based on a supplied
 * array of boundaries.
 */
function _resolveBoundaryDirections(boundaries) {
  const directions = {};

  if (boundaries.length === 0) {
    return;
  }

  // handle degenerate taco case
  if (boundaries.length === 2) {
    let largeBound, smallBound;
    if (Math.abs(boundaries[0].arc) >= Math.abs(boundaries[1].arc)) {
      largeBound = boundaries[0];
      smallBound = boundaries[1];
    }
    else {
      largeBound = boundaries[1];
      smallBound = boundaries[0];
    }
    const largeBoundReversed = largeBound.arc > 0;
    const smallBoundAligned = smallBound.start === largeBound.start;
    const smallBoundReversed = smallBoundAligned ? !largeBoundReversed : largeBoundReversed;
    directions[largeBound.id] = largeBoundReversed ? -1 : 1;
    directions[smallBound.id] = smallBoundReversed ? -1 : 1;
    return directions;
  }

  // otherwise, use the boundary progression
  let prevBound = boundaries[boundaries.length-1];
  for (let bi = 0; bi < boundaries.length; bi++) {
    const nextBound = boundaries[bi];
    const reversed = prevBound.containsPoint(nextBound.end);
    directions[nextBound.id] = reversed ? -1 : 1;
    prevBound = nextBound;
  }
  return directions;
}

/**
 * Constructs an enclosure tree for a given array of cycles
 */
function _constructCycleEnclosureTree(cycles) {

  // resolve arc-interpolated cycle polygons and outer bbox
  const outerBBox = new Box2();
  const cycleArrayPolygons = [];
  for (let ci = 0; ci < cycles.length; ci++) {
    const cycle = cycles[ci];
    const cyclePolygon = _getPolygonWithArcsFromCycle(cycle);
    const cycleArrayPolygon = [];
    for (let pi=0; pi<cyclePolygon.length; pi++) {
      const pnt = cyclePolygon[pi];
      outerBBox.expandByPoint(pnt);
      cycleArrayPolygon.push([pnt.x, pnt.y]);
    }
    cycleArrayPolygons.push(cycleArrayPolygon);
  }

  // create the enclosure tree
  const encTree = new EnclosureTree(outerBBox);

  // assign each cycle an ID and add its polygon to the enclosure tree
  const cyclesByID = {};
  for (let ci=0; ci < cycles.length; ci++) {
    const cycle = cycles[ci];
    const cycleArrayPolygon = cycleArrayPolygons[ci];
    cycle.id = ci + 1;
    cyclesByID[cycle.id] = cycle;
    encTree.addPolygon(cycleArrayPolygon, cycle.id);
  }

  return [encTree, cyclesByID];
}

/**
 * Gets a vertex array, in array-array format, for a given cycle construct
 */
function _getPolygonWithArcsFromCycle(cycle) {
  const points = [];
  for (let bi = 0; bi < cycle.boundaries.length; bi++) {
    const bound = cycle.boundaries[bi];
    const boundReversed = cycle.boundaryDirections[bound.id] === -1;
    const pnt = boundReversed ? bound.end : bound.start;
    points.push(pnt);
    if (bound.arc) {
      const arcPnts = interpolateArcPointsByConstraints(
        bound.start,
        bound.end,
        bound.arc,
        0,
        ARC_INTERPOLATION_PRECISION
      );
      if (boundReversed) {
        arcPnts.reverse();
      }
      points.push(...arcPnts);
    }
  }
  return points;
}

/**
 * Cleanup helper to mark boundaries in an array as un-marked
 */
function _unmarkBoundaries(boundaries) {
  for (let bi = 0; bi < boundaries.length; bi++) {
    const boundary = boundaries[bi];
    boundary.marked = false;
  }
}

/**
 * Traverses a given enclosure tree node, assigning parent nodes and holes
 * in the process
 */
function _assignHolesAndParents (encTree, cyclesByID) {
  const cycles = [];
  encTree.traverseDown((cycleID, parentNodeCycleID) => {
    const cycle = cyclesByID[cycleID];
    cycles.push(cycle);

    DEBUG_QUIETLY || debug(
      "traversing enclosure node %s, parent %s",
      cycleID,
      parentNodeCycleID
    );

    // if the node has a parent, traverse up until the parent cycle is not
    // connected, and if a parent is present, assign it
    let parentNodeCycle = null;
    if (parentNodeCycleID) {
      parentNodeCycle = cyclesByID[parentNodeCycleID];
      while (parentNodeCycle && (cycle.perimeterCycle === parentNodeCycle.perimeterCycle)) {
        parentNodeCycle = parentNodeCycle.parent;
      }
    }
    if (parentNodeCycle) {
      cycle.parent = parentNodeCycle;
      parentNodeCycle.holeCycles.push(cycle);
    }
  });
  cycles.forEach(cycle => {
    if (cycle.holeCycles.length) {
      cycle.holes = _getCombinedPerimeters(cycle.holeCycles);
    }
  });
}

/**
 * Assigns all free-floating boundaries to their enclosing cycle's interior
 * boundaries array. Returns exterior boundaries
 */
function _assignInteriorBoundariesToCycles(encTree, cycles, cyclesByID, boundaries) {
  _unmarkBoundaries(boundaries);
  for (let ci = 0; ci < cycles.length; ci++) {
    const cycle = cycles[ci];
    for (let bi = 0; bi < cycle.boundaries.length; bi++) {
      const bound = cycle.boundaries[bi];
      bound.marked = true;
    }
  }
  const exteriorBounds = [];
  for (let bi = 0; bi < boundaries.length; bi++) {
    const bound = boundaries[bi];
    if (bound.marked) {
      continue;
    }
    const boundCenter = bound.start.clone().add(bound.end).multiplyScalar(0.5);
    if (bound.arc) {
      const boundVect = bound.end.clone().sub(bound.start);
      const boundNorm = new Vector2(-boundVect.y, boundVect.x).normalize();
      boundCenter.add(boundNorm.multiplyScalar(bound.arc));
    }
    const enclosingCycleID = encTree.getEnclosingPolygonIDForPoint(boundCenter);
    if (enclosingCycleID) {
      const enclosingCycle = cyclesByID[enclosingCycleID];
      enclosingCycle.interiorBoundaries.push(bound);
    }
    else {
      exteriorBounds.push(bound);
    }
  }
  return exteriorBounds;
}

/**
 * Gets the perimeter boundaries of a group of cycles, which we already
 * calculated.
 */
function _getCombinedPerimeters (cycles) {

  for (let ci = 0; ci < cycles.length; ci++) {
    const cycle = cycles[ci];
    const perimCycle = cycle.perimeterCycle;
    perimCycle.marked = false;
  }

  const combinedPerimeters = [];
  for (let ci = 0; ci < cycles.length; ci++) {
    const cycle = cycles[ci];
    const perimCycle = cycle.perimeterCycle;
    if (!perimCycle.marked) {
      perimCycle.marked = true;
      combinedPerimeters.push(perimCycle.boundaries);
    }
  }

  return combinedPerimeters;
}

/**
 * Sorts a point's boundary array counter-clockwise. When two boundaries are
 * within an error threshold due to arc angles, we reduce the impact of the
 * arc angle to deal with issues in old data where an overlarge arc causes
 * hard-to-notice intersections.
 */
function _sortPointBoundariesCCW (point) {
  let offsetFound = false;
  const boundaries = point.boundaries;
  for (let bi = 0; bi < boundaries.length; bi++) {
    const bound = boundaries[bi];
    const otherPoint = bound.getOtherPoint(point);
    let rawAngle = otherPoint.clone().sub(point).angle();
    bound.rawAngle = rawAngle; // retain this for arc bugfixes
    const offsetAngle = bound.relativeOffsetAngle;
    if (offsetAngle) {
      offsetFound = true;
      if (bound.start === point) {
        rawAngle += (Math.PI * 2) + offsetAngle;
      }
      else {
        rawAngle += (Math.PI * 2) - offsetAngle;
      }
      rawAngle = rawAngle % (Math.PI * 2);
    }
    bound.angle = rawAngle;
  }

  boundaries.sort(_angleSorter);

  // correct for erroniously-drawn boundaries that have erronious overlaps
  // don't even try to account for arc-arc cases, as that's uncommon, and
  // this really only targets a few complex floorplans with errors.
  if (offsetFound) {
    for (let ai=0; ai < boundaries.length; ai++) {
      const bi = (ai + 1) % boundaries.length;
      const a = boundaries[ai];
      const b = boundaries[bi];

      // if no arc is present, skip. also skip double arcs because we
      // haven't done the math for that.
      if ((!a.arc && !b.arc) || (a.arc && b.arc)) {
        continue;
      }

      let diff = b.angle - a.angle;
      let diffSize = Math.abs(diff);

      // handle wraparound
      if (diffSize > Math.PI * 2 - ARC_OVERLAP_ERROR_THRESHOLD) {
        diff = (diff > 0) ? (diff - Math.PI*2) : (diff + Math.PI*2);
        diffSize = Math.abs(diff);
      }

      if (diffSize < ARC_OVERLAP_ERROR_THRESHOLD) {
        let arcSeg, otherSeg;
        if (a.arc) {
          arcSeg = a;
          otherSeg = b;
          diff = -diff;
        }
        else {
          arcSeg = b;
          otherSeg = a;
        }
        let arcOffset = arcSeg.angle - arcSeg.rawAngle;
        if (arcOffset > Math.PI) {
          arcOffset += -Math.PI * 2;
        }
        else if (arcOffset < -Math.PI) {
          arcOffset += Math.PI * 2;
        }

        const potentialIntersection = (arcOffset*diff) > 0;
        if (!potentialIntersection) {
          continue;
        }

        const arcSegLen = arcSeg.end.clone().sub(arcSeg.start).length();
        const otherSegLen = otherSeg.end.clone().sub(otherSeg.start).length();
        const arcRadius = computeArcRadius(arcSegLen, arcSeg.arc);
        const intersectionDist = computeChordLengthFromRadiusAndAngle(arcRadius, diff);

        if (otherSegLen > intersectionDist) {
          debug("detected arc/boundary intersection error, auto-correcting");
          boundaries[bi] = a;
          boundaries[ai] = b;
          continue;
        }
      }
    }
  }
}
function _angleSorter(a, b) {
  return a.angle - b.angle;
}

/**
 * Sets the precision at which arcs will be interpolated during cycle nesting
 * computations, in radians. Smaller is more precise.
 * @param angle: precision of arc interpolation
 */
function setArcInterpolationPrecision (angle) {
  ARC_INTERPOLATION_PRECISION = angle;
}

/**
 * Internal class for representing and merging boundary groupings during
 * room combination.
 */
function _BoundaryGroup (boundToGroupMap, boundRefCounts) {
  this.id = _BoundaryGroup._nextID++;
  this.boundArr = [];
  this.boundSet = {};
  this.boundToGroupMap = boundToGroupMap;
  this.boundRefCounts = boundRefCounts;
  this.shouldBeSkipped = false;
}
_BoundaryGroup.prototype = {
  constructor: _BoundaryGroup,
  ingest: function (boundIDs) {
    const otherGroupIDSet = {};
    const otherGroups = [];
    for (let bi = 0; bi < boundIDs.length; bi++) {
      const boundID = boundIDs[bi];
      const boundCurrentGroup = this.boundToGroupMap[boundID];
      if (boundCurrentGroup) {
        this.boundRefCounts[boundID]++;
        if (!otherGroupIDSet[boundCurrentGroup.id]) {
          otherGroupIDSet[boundCurrentGroup.id] = 1;
          otherGroups.push(boundCurrentGroup);
        }
      }
      else {
        this.boundRefCounts[boundID] = 1;
        this.boundToGroupMap[boundID] = this;
        this.boundArr.push(boundID);
        this.boundSet[boundID] = 1;
      }
    }
    return otherGroups.reduce((merged, group) => merged.merge(group), this);
  },
  merge: function (otherGroup) {
    for (let bi = 0; bi < otherGroup.boundArr.length; bi++) {
      const boundID = otherGroup.boundArr[bi];
      if (this.boundRefCounts[boundID] === 1) {
        this.boundToGroupMap[boundID] = this;
        this.boundArr.push(boundID);
        this.boundSet[boundID] = 1;
      }
      else {
        this.boundToGroupMap[boundID] = undefined;
        this.boundSet[boundID] = undefined;
      }
    }
    otherGroup.shouldBeSkipped = true;
    return this;
  }
};
_BoundaryGroup._nextID = 1;

/**
 * Simplified area calculation for cycles
 * @return: area of cycle
 */
function _getCycleArea (cycle) {
  let area = 0;
  const dirs = _resolveBoundaryDirections(cycle.boundaries);
  const firstBoundReversed = dirs[cycle.boundaries[0]] === -1;
  let prevPoint = firstBoundReversed ?
    cycle.boundaries[0].end :
    cycle.boundaries[0].start;
  for (let bi=0; bi<cycle.boundaries.length; bi++) {
    const bound = cycle.boundaries[bi];
    const boundReversed = dirs[bound.id] === -1;
    const nextPoint = boundReversed ? bound.start : bound.end;
    area += prevPoint.x * nextPoint.y;
    area -= prevPoint.y * nextPoint.x;
    prevPoint = nextPoint;
  }
  area /= 2;
  return Math.abs(area);
}

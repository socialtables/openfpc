import { checkIntersection } from "line-intersect";
import { Map } from "immutable";
import shortid from "shortid";
import QuadTree from "simple-quadtree";
import { Box2, Vector2 } from "three";
import { Point, Boundary } from "../model";

/**
 * LineSegment class
 */
export class LineSegment {
  constructor ({
    startId,
    endId,
    id,
    origin,
    tangent,
    minExtent,
    maxExtent,
    weight
  } = {}) {
    // we use these to maintain stable IDs in the scene while drawing
    this.startId = startId || shortid.generate();
    this.endId = endId || shortid.generate();
    this.id = id || shortid.generate();
    // we use these for intersection
    this.origin = origin || new Vector2();
    this.tangent = tangent || new Vector2();
    this.minExtent = minExtent || 0;
    this.maxExtent = maxExtent || 0;
    this.weight = weight || 1;
    this.merged = false;
    // we use these during the cleanup phase
    this.isValid = true;
    this.oddIntersections = 0;
    this.intersections = [];
  }
  /**
   * Merges this segment with another segment
   */
  merge (otherSegment, otherSegFlipped) {
    // get relative weight
    const relativeWeight = this.weight / (this.weight + otherSegment.weight);
    const otherRelativeWeight = 1 - relativeWeight;

    // get pre-merge endpoints for both segments
    const endpoints = [
      this.tangent.clone().multiplyScalar(this.minExtent).add(this.origin),
      this.tangent.clone().multiplyScalar(this.maxExtent).add(this.origin),
      otherSegment.tangent.clone().multiplyScalar(otherSegment.minExtent)
      .add(otherSegment.origin),
      otherSegment.tangent.clone().multiplyScalar(otherSegment.maxExtent)
      .add(otherSegment.origin)
    ];

    // do a weighted average on the origin point and tangent
    this.tangent.multiplyScalar(relativeWeight)
    .add(
      otherSegment.tangent.clone()
      .multiplyScalar(otherRelativeWeight * (otherSegFlipped ? -1 : 1))
    );
    this.tangent.normalize();
    this.origin = this.origin.clone().multiplyScalar(relativeWeight)
    .add(otherSegment.origin.clone().multiplyScalar(otherRelativeWeight));

    // increment weight to reflect the combined segment weight
    this.weight += otherSegment.weight;

    // finally, re-calculate extents based on pre-merge endpoints
    this.minExtent = Infinity;
    this.maxExtent = -Infinity;
    endpoints.forEach(p => {
      this.minExtent = Math.min(this.minExtent, p.clone().sub(this.origin)
      .dot(this.tangent));
      this.maxExtent = Math.max(this.maxExtent, p.clone().sub(this.origin)
      .dot(this.tangent));
    });
  }
  centerOrigin () {
    const minExtent = this.minExtent;
    const maxExtent = this.maxExtent;
    const length = Math.abs(maxExtent - minExtent);
    const centerExtent = (minExtent + maxExtent) * 0.5;
    this.origin = this.origin.clone().add(this.tangent.clone().multiplyScalar(centerExtent));
    this.minExtent = -length / 2;
    this.maxExtent = length / 2;
    return this;
  }
}

/**
 * Combines an array of existing segments with an array of new segments
 * @param existingSegments - existing LineSegments array
 * @param newSegments - new lineSegments array
 * @param segMergeDistThreshold - merge distance threshold
 * @param segMergeDotThreshold - merge dot product threshold
 * @returns - an array of LineSegments
 */
export function combineSegments (existingSegments, newSegments, {
  segMergeDistThreshold = 1,
  segMergeDotThreshold = 0.98
} = {}) {
  const resultSegments = existingSegments.slice(0);

  // for each new segment, attempt intersection with neighbors
  for (let nsi = 0; nsi < newSegments.length; nsi++) {
    const newSeg = newSegments[nsi];
    let newSegMergedWithSegment = null;
    for (let si = 0; si < resultSegments.length; si++) {
      const seg = resultSegments[si];
      // don't merge if we've already merged the segment - it's scheduled for
      // removal in the next pass
      if (seg.merged) {
        continue;
      }
      let segDot = seg.tangent.dot(newSeg.tangent);
      let segFlipped = false;
      if (segDot < 0) {
        segFlipped = true;
        segDot = segDot * -1;
      }
      // don't merge if directions aren't similar
      if (segDot < segMergeDotThreshold) {
        continue;
      }
      const lineOriginOffset = newSeg.origin.clone().sub(seg.origin);
      const distanceFromSegLine = Math.abs(seg.tangent.cross(lineOriginOffset));
      if (distanceFromSegLine > segMergeDistThreshold) {
        continue;
      }
      // find the relative bounds of the new line relative to the segment
      let minExtent = Infinity;
      let maxExtent = -Infinity;
      [
        lineOriginOffset.clone()
        .add(newSeg.tangent.clone().multiplyScalar(newSeg.minExtent)),
        lineOriginOffset.clone()
        .add(newSeg.tangent.clone().multiplyScalar(newSeg.maxExtent))
      ]
      .forEach(lineEndpointOffset => {
        minExtent = Math.min(minExtent, seg.tangent.dot(lineEndpointOffset));
        maxExtent = Math.max(maxExtent, seg.tangent.dot(lineEndpointOffset));
      });
      // if there's not an intersection, there's nothing to do here
      if ((minExtent > seg.maxExtent) || (maxExtent < seg.minExtent)) {
        continue;
      }
      // if not merged yet, do so
      if (!newSegMergedWithSegment) {
        newSegMergedWithSegment = seg;
        seg.merge(newSeg, segFlipped);
      }
      // otherwise, merge this segment with the merged segment and throw away
      // the merged segment; we're doing a 3+ way merge
      else {
        const merged = newSegMergedWithSegment;
        newSegMergedWithSegment = seg;
        merged.merged = true;
        const mergedFlipped = merged.tangent.dot(seg.tangent) < 0;
        seg.merge(merged, mergedFlipped);
      }
    }
    // if the new segment was not merged, add it to the result set
    if (!newSegMergedWithSegment) {
      resultSegments.push(newSeg);
    }
  }

  return resultSegments.filter(seg => !seg.merged);
}

/**
 * Removes all segments that intersect with others at odd angles and have an
 * unusually low weight
 * @param segments - an array of LineSegments
 * @param weightCutoff - weight ratio cutoff for odd-angle segments
 * @param oddIntersectCount - intersect count to use to identify off-angle
 * segments that we want to ignore
 */
export function removeSmallAndOddAngleSegments (segments, {
  weightCutoff = 0.25,
  oddIntersectCount = 2
} = {}) {
  // get average segment weight
  let totalWeight = 0;
  segments.forEach(seg => totalWeight += seg.weight);
  const averageWeight = totalWeight / (segments.length || 1);

  // flag segments that don't belong as invalid
  for (let a = 0; a < segments.length; a++) {
    const segA = segments[a];
    const startA = segA.tangent.clone().multiplyScalar(segA.minExtent)
    .add(segA.origin);
    const endA = segA.tangent.clone().multiplyScalar(segA.maxExtent)
    .add(segA.origin);
    for (let b = a + 1; b < segments.length; b++) {
      const segB = segments[b];
      const aDotB = segA.tangent.dot(segB.tangent);
      if (Math.abs(aDotB) > 0.95 || Math.abs(aDotB) < 0.1) {
        continue;
      }
      const startB = segB.tangent.clone().multiplyScalar(segB.minExtent)
      .add(segB.origin);
      const endB = segB.tangent.clone().multiplyScalar(segB.maxExtent)
      .add(segB.origin);
      const intersect = checkIntersection(
        startA.x, startA.y,
        endA.x, endA.y,
        startB.x, startB.y,
        endB.x, endB.y
      );
      if (intersect.type !== "intersecting") {
        continue;
      }
      segA.oddIntersections++;
      segB.oddIntersections++;
    }
    if (
      segA.oddIntersections >= oddIntersectCount &&
      segA.weight < averageWeight * weightCutoff
    ) {
      segA.isValid = false;
    }
  }

  return segments.filter(segment => segment.isValid);
}

/**
 * Intersects all segments and gets the resulting scene entities
 * @param segments - an array of LineSegments
 * @param extendDist - distance to extend segments
 * @param minLength - minimum segment length
 * @returns - an Immutable map of scene entities
 */
export function intersectAllSegmentsAndGetSceneEntities (segments, {
  extendDist = 5,
  minLength = 4
} = {}) {
  // intersect all segments with one another
  const intersectionPoints = [];
  for (let a = 0; a < segments.length; a++) {
    const segA = segments[a];
    const startA = segA.tangent.clone()
    .multiplyScalar(segA.minExtent - extendDist).add(segA.origin);
    const endA = segA.tangent.clone()
    .multiplyScalar(segA.maxExtent + extendDist).add(segA.origin);
    for (let b = a + 1; b < segments.length; b++) {
      const segB = segments[b];
      const startB = segB.tangent.clone()
      .multiplyScalar(segB.minExtent - extendDist).add(segB.origin);
      const endB = segB.tangent.clone()
      .multiplyScalar(segB.maxExtent + extendDist).add(segB.origin);
      const intersect = checkIntersection(
        startA.x, startA.y,
        endA.x, endA.y,
        startB.x, startB.y,
        endB.x, endB.y
      );
      if (intersect.type === "intersecting") {
        const intersectId = shortid.generate();
        const intersectPoint = new Vector2(
          intersect.point.x,
          intersect.point.y
        );
        intersectionPoints.push(
          Point.fromJS(intersectPoint).set("id", intersectId)
        );
        const intersectExtentA = intersectPoint.clone().sub(segA.origin)
        .dot(segA.tangent);
        segA.intersections.push({
          id: intersectId,
          extent: intersectExtentA
        });
        const intersectExtentB = intersectPoint.clone().sub(segB.origin)
        .dot(segB.tangent);
        segB.intersections.push({
          id: intersectId,
          extent: intersectExtentB
        });
      }
    }
  }

  // compute final segments using raw segments and their intersections
  const finalEndpoints = [];
  const finalSegments = [];

  segments.forEach(seg => {
    let startPointIsIntersect = false;
    let endPointIsIntersect = false;
    seg.intersections.forEach(intersect => {
      if (intersect.extent <= seg.minExtent) {
        startPointIsIntersect = true;
      }
      if (intersect.extent >= seg.maxExtent) {
        endPointIsIntersect = true;
      }
    });
    seg.intersections.sort((a, b) => {
      if (a.extent < b.extent) {
        return -1;
      }
      if (a.extent > b.extent) {
        return 1;
      }
      return 0;
    });
    const subSegmentEndpoints = [];
    if (!startPointIsIntersect) {
      subSegmentEndpoints.push({
        id: seg.startId,
        extent: seg.minExtent,
        isEndpoint: true,
        point: seg.tangent.clone().multiplyScalar(seg.minExtent).add(seg.origin)
      });
    }
    subSegmentEndpoints.push(...seg.intersections);
    if (!endPointIsIntersect) {
      subSegmentEndpoints.push({
        id: seg.endId,
        extent: seg.maxExtent,
        isEndpoint: true,
        point: seg.tangent.clone().multiplyScalar(seg.maxExtent).add(seg.origin)
      });
    }
    for (let i = 0; i < subSegmentEndpoints.length - 1; i++) {
      const a = subSegmentEndpoints[i];
      const b = subSegmentEndpoints[i + 1];
      // don't include degenerate end segments in the final result
      if (a.isEndpoint || b.isEndpoint) {
        if (b.extent - a.extent < minLength) {
          continue;
        }
      }
      if (a.isEndpoint) {
        finalEndpoints.push(a);
      }
      if (b.isEndpoint) {
        finalEndpoints.push(b);
      }
      finalSegments.push({
        startId: a.id,
        endId: b.id
      });
    }
  });

  const finalEntitiesObj = {};
  finalEndpoints.forEach(p => {
    const scenePoint = Point.fromJS(p.point).set("id", p.id);
    finalEntitiesObj[scenePoint.get("id")] = scenePoint;
  });
  intersectionPoints.forEach(p => finalEntitiesObj[p.get("id")] = p);
  finalSegments.forEach(s => {
    const sceneBound = new Boundary({
      start: s.startId,
      end: s.endId
    });
    finalEntitiesObj[sceneBound.get("id")] = sceneBound;
  });

  const finalEntitiesMap = new Map(finalEntitiesObj);
  return finalEntitiesMap;
}

/**
 * Converts middle-out centroid lines to segments
 * UNUSED currently - but worth keeping for future refactors
 * @param centroidLines - an array of lines posessing center, tangent, and
 * length
 * @param lineScale - scale of the lines in the scene
 * @returns - an array of LineSegments
 */
export function segmentsFromCentroidLines (centroidLines, lineScale = 1) {
  return centroidLines.map(line => new LineSegment({
    origin: new Vector2(line.center.x, line.center.y),
    tangent: new Vector2(line.tangent.x, line.tangent.y).normalize(),
    minExtent: -line.length * lineScale / 2,
    maxExtent: line.length * lineScale / 2,
    weight: line.length
  }));
}

/**
 * Converts scene entities to segments
 * @param sceneEntities - an Immutable map of all scene entities
 * @param segmentEntities - an Immutalbe map or array of boundaries
 * @returns - an array of LineSegments
 */
export function segmentsFromSceneEntitiesMap (sceneEntities, segmentEntities) {
  const segments = [];
  segmentEntities.forEach(entity => {
    if (entity.get("type") === "boundary") {
      const startPoint = sceneEntities.get(entity.get("start"));
      const endPoint = sceneEntities.get(entity.get("end"));
      if (!startPoint) {
        throw new Error("missing start point", entity.get("start"));
      }
      if (!endPoint) {
        throw new Error("missing end point", entity.get("end"));
      }
      const start2 = startPoint.toVector2();
      const end2 = endPoint.toVector2();
      const length = end2.clone().sub(start2).length();
      const segment = new LineSegment({
        id: entity.get("id"),
        startId: startPoint.get("id"),
        endId: endPoint.get("id"),
        origin: end2.clone().add(start2).multiplyScalar(0.5),
        tangent: end2.clone().sub(start2).normalize(),
        minExtent: -length / 2,
        maxExtent: length / 2,
        weight: length
      });
      segments.push(segment);
    }
  });
  return segments;
}

/**
 * Converts segments to scene entities
 * @param segments - an array of LineSegments
 * @returns - an Immutalbe map of all scene entities for the segments
 */
export function segmentsToSceneEntitiesMap (segments) {
  const sceneEntitiesObj = {};
  segments.forEach(seg => {
    const start2 = seg.tangent.clone().multiplyScalar(seg.maxExtent)
    .add(seg.origin);
    const end2 = seg.tangent.clone().multiplyScalar(seg.minExtent)
    .add(seg.origin);
    const startPoint = Point.fromJS(start2).set("id", seg.startId);
    const endPoint = Point.fromJS(end2).set("id", seg.endId);
    const boundary = new Boundary({
      start: seg.startId,
      end: seg.endId
    }).set("id", seg.id);
    sceneEntitiesObj[startPoint.get("id")] = startPoint;
    sceneEntitiesObj[endPoint.get("id")] = endPoint;
    sceneEntitiesObj[boundary.get("id")] = boundary;
  });
  return new Map(sceneEntitiesObj);
}

/**
 * Gets an Immutable map of all corner points in a given Immutable scene entity
 * map
 * UNUSED currently but I have plans to use this in scene entity simplification
 * code
 * @param sceneEntities - an Immutalbe map of scene entities
 * @returns - an Immutable map of all corner points
 */
export function getSceneEntityCorners (sceneEntities) {
  const pointRefCount = {};
  sceneEntities.forEach(e => {
    if (e.get("type") === "boundary") {
      pointRefCount[e.get("start")] = (pointRefCount[e.get("start")] || 0) + 1;
      pointRefCount[e.get("end")] = (pointRefCount[e.get("end")] || 0) + 1;
    }
  });
  return sceneEntities.filter(e =>
    (e.get("type") === "point") &&
    (pointRefCount[e.get("id")] > 1)
  );
}

/**
 * Removes segment parts that intersect existing scene entities and returns
 * the resulting segments, or the original segment if nothing was removed
 * @param segment - the segment to cut down
 * @param sliceBySegments - the segments to remove from the segment if found to
 * be within merge distance
 * @returns an array of LineSegments
 */
export function sliceSegment (segment, sliceBySegments, {
  minLength = 1,
  proximity = 3
} = {}) {
  if (!sliceBySegments.length) {
    return [segment];
  }
  let slices = [segment];
  sliceBySegments.forEach(sliceSegment => {
    // compare the directionality of the segments
    let segDot = segment.tangent.dot(sliceSegment.tangent);
    const sliceFlipped = segDot < 0;
    if (sliceFlipped) {
      segDot = segDot * -1;
    }
    if (segDot < 0.5) {
      return;
    }
    // get the slice segment's origin's distance from the segment line
    const sliceSegmentOriginOffset = sliceSegment.origin.clone()
    .sub(segment.origin);
    const distanceFromSegLine = Math.abs(
      segment.tangent.cross(sliceSegmentOriginOffset)
    );
    if (distanceFromSegLine > proximity) {
      return;
    }
    // remove the sliceSegment from each slice, update slices
    const nextSlices = [];
    slices.forEach(slice => {
      let minExtent = Infinity;
      let maxExtent = -Infinity;
      [
        sliceSegment.origin.clone()
        .sub(slice.origin)
        .add(
          sliceSegment.tangent.clone().multiplyScalar(sliceSegment.minExtent)
        ),
        sliceSegment.origin.clone()
        .sub(slice.origin)
        .add(
          sliceSegment.tangent.clone().multiplyScalar(sliceSegment.maxExtent)
        )
      ]
      .forEach(endpoint => {
        minExtent = Math.min(minExtent, slice.tangent.dot(endpoint));
        maxExtent = Math.max(maxExtent, slice.tangent.dot(endpoint));
      });
      // case 1 - not overlapping
      if ((minExtent > slice.maxExtent) || (maxExtent < slice.minExtent)) {
        nextSlices.push(slice);
        return;
      }
      // case 2 - overlap on left
      if ((minExtent <= slice.minExtent) && (maxExtent <= slice.maxExtent)) {
        nextSlices.push(new LineSegment({
          origin: slice.origin,
          tangent: slice.tangent,
          minExtent: maxExtent,
          maxExtent: slice.maxExtent
        }).centerOrigin());
      }
      // case 3 - overlap on right
      if ((minExtent >= slice.minExtent) && (maxExtent >= slice.maxExtent)) {
        nextSlices.push(new LineSegment({
          origin: slice.origin,
          tangent: slice.tangent,
          minExtent: slice.minExtent,
          maxExtent: minExtent
        }).centerOrigin());
      }
      // case 4 - overlap in center
      if (minExtent > slice.minExtent && maxExtent < slice.maxExtent) {
        nextSlices.push(new LineSegment({
          origin: slice.origin,
          tangent: slice.tangent,
          minExtent: slice.minExtent,
          maxExtent: minExtent
        }).centerOrigin());
        nextSlices.push(new LineSegment({
          origin: slice.origin,
          tangent: slice.tangent,
          minExtent: maxExtent,
          maxExtent: slice.maxExtent
        }).centerOrigin());
      }
      // // case 5 - complete overlap, no more slice
    });
    slices = nextSlices.filter(s => s.maxExtent - s.minExtent > minLength);
  });

  return slices;
}

/**
 * De-dups points from a collection of scene entities
 * @param sceneEntities - new entities to process
 * @param anchoredSceneEntities - entities to leave alone
 * @returns - a map of de-duped scene entities
 */
export function dedupPoints (sceneEntities, anchoredSceneEntities, {
  mergeDist = 1
} = {}) {
  // find the outer bounding box of the scene
  const bbox = new Box2();
  const bboxPoint = new Vector2();
  anchoredSceneEntities.forEach(e => {
    if (e.get("type") !== "point") {
      return;
    }
    bboxPoint.x = e.get("x");
    bboxPoint.y = e.get("y");
    bbox.expandByPoint(bboxPoint);
  });
  sceneEntities.forEach(e => {
    if (e.get("type") !== "point") {
      return;
    }
    bboxPoint.x = e.get("x");
    bboxPoint.y = e.get("y");
    bbox.expandByPoint(bboxPoint);
  });
  // construct a quadtree
  const qt = new QuadTree(
    bbox.min.x,
    bbox.min.y,
    bbox.max.x - bbox.min.x,
    bbox.max.y - bbox.min.y,
    { maxChildren: 8 }
  );
  // add all the anchored points
  anchoredSceneEntities.forEach(e => {
    if (e.get("type") !== "point") {
      return;
    }
    const qtPoint = {
      x: e.get("x"),
      y: e.get("y"),
      w: 0,
      h: 0,
      id: e.get("id"),
      anchored: true
    };
    qt.put(qtPoint);
  });
  // for each scene point, check for neighbors, merge if neighbors are present,
  // and update quadtree
  const pointMergeMap = {};
  const qtBBox = { x: 0, y: 0, w: mergeDist, h: mergeDist };
  sceneEntities.forEach(e => {
    if (e.get("type") !== "point") {
      return;
    }
    const qtPoint = {
      x: e.get("x"),
      y: e.get("y"),
      w: 0,
      h: 0,
      id: e.get("id"),
      weight: 1
    };
    qtBBox.x = qtPoint.x - mergeDist / 2;
    qtBBox.y = qtPoint.y - mergeDist / 2;
    const qtHits = qt.get(qtBBox);
    let closestHit = null;
    let closestHitDist = Infinity;
    qtHits.forEach(h => {
      const dx = h.x - qtPoint.x;
      const dy = h.y - qtPoint.y;
      const hDist = Math.sqrt(dx * dx + dy * dy);
      if (!closestHit || (closestHitDist > hDist)) {
        closestHit = h;
        closestHitDist = hDist;
      }
    });
    if (closestHit) {
      pointMergeMap[qtPoint.id] = closestHit.id;
      if (!closestHit.anchored) {
        qt.remove(closestHit, "id");
        const relativeWeight = 1 / (1 + closestHit.weight);
        const dx = qtPoint.x - closestHit.x;
        const dy = qtPoint.y - closestHit.y;
        closestHit.weight++;
        closestHit.x += dx * relativeWeight;
        closestHit.y += dy * relativeWeight;
        qt.put(closestHit);
      }
    }
    else {
      qt.put(qtPoint);
    }
  });
  // go through all boundaries and create updated variants if one or more
  // points were merged. if completely collapsed, ignore.
  const finalEntitiesById = {};
  sceneEntities.forEach(e => {
    const id = e.get("id");
    const eType = e.get("type");
    if (eType === "point") {
      if (!pointMergeMap[id]) {
        finalEntitiesById[id] = e;
      }
    }
    else if (eType === "boundary") {
      const startId = e.get("start");
      const endId = e.get("end");
      if (pointMergeMap[startId] || pointMergeMap[endId]) {
        if (pointMergeMap[startId] === pointMergeMap[endId]) {
          return;
        }
        const newBoundary = new Boundary({
          start: pointMergeMap[startId] || startId,
          end: pointMergeMap[endId] || endId
        });
        finalEntitiesById[newBoundary.get("id")] = newBoundary;
      }
      else {
        finalEntitiesById[id] = e;
      }
    }
    else {
      finalEntitiesById[id] = e;
    }
  });
  // and we're done!
  return new Map(finalEntitiesById);
}

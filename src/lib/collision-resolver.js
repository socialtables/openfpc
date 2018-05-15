import sat from "sat";
import * as three from "three";
import QuadTree from "simple-quadtree";
import decomp from "poly-decomp";
import Map from "es6-map";

// internal SAT polygon conversion helper
function _arrayPolygonToSAT(srcPolygon) {
  return new sat.Polygon(
    new sat.Vector(),
    srcPolygon.map(pt => new sat.Vector(pt[0], pt[1]))
  );
}

/**
 * Internal point class with quadtree position props and CR helpers
 * @property {(string|number)} id - source ID
 * @property {three.Vector2} point - vector2 position
 * @property {number} x - x property for quadtree
 * @property {number} y - y property for quadtree
 * @property {number} w - width property for quadtree
 * @property {number} h - height property for quadtree
 */
class CRPoint {
  /**
   * @param {(string|number)} id - source ID of point
   * @param {Object} point - source point object (generally a Vector2/3)
   * @param {number} point.x - x coordinate of point
   * @param {number} point.y - y coordinate of point
   */
  constructor (id, point) {
    this.id = id;
    this.point = new three.Vector2(point.x, point.y);
    // assign quadtree props
    this.x = point.x;
    this.y = point.y;
    this.w = 1;
    this.h = 1;
  }
  /**
   * @param {Object} position - 2D position with x and y value
   * @return {number} - the distance from the specified position
   */
  getDist (position) {
    return this.point.clone().sub(position).length();
  }
  /**
   * @param {three.Box2} bbox - bbox to check for point containment
   * @return {boolean} - true or false indicating containment
   */
  isEnclosed (bbox) {
    return bbox.containsPoint(this.point);
  }
}

/**
 * Internal line class with quadtree props and CR helpers
 * @property {(string|number)} id - source ID
 * @property {three.Vector2} a - start position
 * @property {three.Vector2} b - end position
 * @property {three.Box2} bbox - 2D bounding box
 * @property {number} x - x property for quadtree
 * @property {number} y - y property for quadtree
 * @property {number} w - width property for quadtree
 * @property {number} h - height property for quadtree
 * @property {number} relativeWeight - relative weight for snap calculations
 */
class CRLine {
  /**
   * @param {(string|number)} id - source ID of point
   * @param {Object} startPoint - source point object (generally a Vector2/3)
   * @param {number} startPoint.x - x coordinate of point
   * @param {number} startPoint.y - y coordinate of point
   * @param {Object} endPoint - source point object (generally a Vector2/3)
   * @param {number} endPoint.x - x coordinate of point
   * @param {number} endPoint.y - y coordinate of point
   * @param {number} relativeWeight - relative weight for snap calculations
   */
  constructor (id, startPoint, endPoint, relativeWeight=0) {
    this.id = id;
    this.a = new three.Vector2(startPoint.x, startPoint.y);
    this.b = new three.Vector2(endPoint.x, endPoint.y);
    this.relativeWeight = relativeWeight;
    // find bounding box
    this.bbox = new three.Box2();
    this.bbox.expandByPoint(this.a);
    this.bbox.expandByPoint(this.b);
    // assign quadtree props
    this.x = this.bbox.min.x;
    this.y = this.bbox.min.y;
    this.w = this.bbox.max.x - this.bbox.min.x;
    this.h = this.bbox.max.y - this.bbox.min.y;
  }
  /**
   * Gets the distance to this segment from position
   * @param {Object} position - 2D position with x and y value
   * @return {number} - the distance from the specified position
   */
  getDist (position) {
    const delta = position.clone().sub(this.a);
    const lineDelta = this.b.clone().sub(this.a);
    const lineLength = lineDelta.length();
    lineDelta.normalize();
    const deltaDist = lineDelta.dot(delta);
    if (deltaDist < 0) {
      return position.clone().sub(this.a).length();
    }
    if (deltaDist > lineLength) {
      return position.clone().sub(this.b).length();
    }
    const lineOrthog = new three.Vector2(-lineDelta.y, lineDelta.x);
    const orthogDist = lineOrthog.dot(delta);
    return Math.abs(orthogDist);
  }
  /**
   * Gets the distance to this segment, and the nearest point along it
   * @param {Object} position - 2D position with x and y value
   * @return {[number, three.Vector2, three.Vector2]} - the distance, nearest
   *   point, and vector towards the nearest point on the line
   */
  getDistAndNearestPoint (cursorPosition) {
    const delta = cursorPosition.clone().sub(this.a);
    const lineDelta = this.b.clone().sub(this.a);
    const lineLength = lineDelta.length();
    lineDelta.normalize();
    const deltaDist = lineDelta.dot(delta);
    if (deltaDist < 0) {
      const resultPoint = this.a.clone();
      const resultDelta = resultPoint.clone().sub(cursorPosition);
      return [
        resultDelta.length(),
        resultPoint,
        resultDelta.normalize()
      ];
    }
    if (deltaDist > lineLength) {
      const resultPoint = this.b.clone();
      const resultDelta = resultPoint.clone().sub(cursorPosition);
      return [
        resultDelta.length(),
        resultPoint,
        resultDelta.normalize()
      ];
    }
    const lineOrthog = new three.Vector2(-lineDelta.y, lineDelta.x);
    const orthogDist = lineOrthog.dot(delta);
    const resultPoint = this.a.clone()
    .add(lineDelta.multiplyScalar(deltaDist));
    return [
      Math.abs(orthogDist),
      resultPoint,
      resultPoint.clone().sub(cursorPosition).normalize()
    ];
  }
  isEnclosed (bbox) {
    return bbox.containsBox(this.bbox);
  }
}

/**
 * Region class for collision resolver
 */
class CRRegion {
  constructor (id, points, treeDepth=0) {
    this.id = id;
    this.points = points.map(p => new three.Vector2(p.x, p.y));
    const bbox = this.bbox = new three.Box2();
    this.points.forEach(p => this.bbox.expandByPoint(p));
    this.x = bbox.min.x;
    this.y = bbox.min.y;
    this.w = bbox.max.x - bbox.min.x;
    this.h = bbox.max.y - bbox.min.y;
    this.srcPolygon = points.map(vtx => [vtx.x, vtx.y]);
    this.convexParts = [];
    this.treeDepth = treeDepth;
    decomp.makeCCW(this.srcPolygon);
    this.convexParts = decomp
    .quickDecomp(this.srcPolygon)
    .map(_arrayPolygonToSAT);
  }
  getDist (cursorPosition) {
    let minDist = Number.MAX_VALUE;
    const circleWidth = 50;
    const circle = new sat.Circle(new sat.Vector(cursorPosition.x, cursorPosition.y), circleWidth);
    const satResp = new sat.Response();
    this.convexParts.forEach(partSATInstance => {
      satResp.clear();
      const colliding = sat.testPolygonCircle(partSATInstance, circle, satResp);
      if (colliding) {
        const dist = -satResp.overlap;
        if (dist < minDist) {
          minDist = dist;
        }
      }
    });
    if (circleWidth + minDist < 0) {
      return 1 / (circleWidth + minDist);
    }
    return (circleWidth + minDist);
  }
  isEnclosed (bbox) {
    return bbox.containsBox(this.bbox);
  }
}

/**
 * Collision resolver class - keeps track of what's where
 */
export default class CollisionResolver {
  constructor (bbox) {
    // set up broad-phase collision-checker
    this.quadtree = new QuadTree(
      bbox.min.x,
      bbox.min.y,
      bbox.max.x - bbox.min.x,
      bbox.max.y - bbox.min.y,
      { maxchildren: 8 }
    );

    // assign default selection radiuses
    this.pointRadius = 10;
    this.lineRadius = 4;

    // bookkeeping
    this.idToEntity = new Map();
  }
  addPoint (id, srcPoint) {
    this.remove(id);
    const point = new CRPoint(id, srcPoint);
    this.idToEntity[id] = point;
    this.quadtree.put(point);
    this.idToEntity.set(id, point);
  }
  addLine (id, srcPoints, relativeWeight) {
    this.remove(id);
    const entryArr = [];
    for (let i=1; i<srcPoints.length; i++) {
      const line = new CRLine(id, srcPoints[i-1], srcPoints[i], relativeWeight);
      this.quadtree.put(line);
      entryArr.push(line);
    }
    this.idToEntity.set(id, entryArr);
  }
  addRegion (id, srcPoints, treeDepth=0) {
    this.remove(id);
    // code smell, but lets us not crash app
    if (!srcPoints.length) {
      return;
    }
    const region = new CRRegion(id, srcPoints, treeDepth);
    this.quadtree.put(region);
    this.idToEntity.set(id, region);
  }
  addMultiRegion (id, srcRegions) {
    this.remove(id);
    const entryArr = [];
    for (let i=0; i<srcRegions.length; i++) {
      const srcPoints = srcRegions[i];
      // skip degenerate lines
      if (srcPoints.length < 3) {
        continue;
      }
      const region = new CRRegion(id, srcPoints);
      this.quadtree.put(region);
      entryArr.push(region);
    }
    this.idToEntity.set(id, entryArr);
  }
  remove (id) {
    const entity = this.idToEntity.get(id);
    if (entity) {
      if (Array.isArray(entity)) {
        entity.forEach(subEntity => this.quadtree.remove(subEntity, "id"));
      }
      else {
        this.quadtree.remove(entity, "id");
      }
      this.idToEntity.delete(id);
    }
  }
  resolveSelectionBox (bbox) {
    const qtBBox = {
      x: bbox.min.x,
      y: bbox.min.y,
      w: bbox.max.x - bbox.min.x,
      h: bbox.max.y - bbox.min.y
    };
    const rawHits = this.quadtree.get(qtBBox);
    const visitedIDs = {};
    const hits = [];
    rawHits.forEach(hit => {
      if (visitedIDs[hit.id]) {
        return;
      }
      visitedIDs[hit.id] = 1;
      const restOfEntity = this.idToEntity.get(hit.id);
      if (Array.isArray(restOfEntity)) {
        const uncontained = restOfEntity.find(se => !se.isEnclosed(bbox));
        if (!uncontained) {
          hits.push(hit);
        }
      }
      if (hit.isEnclosed(bbox)) {
        hits.push(hit);
      }
    });
    return hits.map(h => h.id);
  }
  resolveSelection (cursorPosition, disqualify = null, weights = {}) {
    const cursorRadius = Math.max(this.pointRadius, this.lineRadius);
    const cursorBBox = {
      x: cursorPosition.x - cursorRadius,
      y: cursorPosition.y - cursorRadius,
      w: cursorRadius * 2,
      h: cursorRadius * 2
    };
    const hits = this.quadtree.get(cursorBBox, cursorRadius);

    let bestHitDist = Number.MAX_VALUE;
    let bestHit = null;
    hits.forEach(item => {
      let itemDist = item.getDist(cursorPosition);
      if (item instanceof CRLine) {
        itemDist -= this.lineRadius;
        itemDist -= weights.lines || 0;
      }
      if (item instanceof CRPoint) {
        itemDist -= this.pointRadius;
        itemDist -= weights.points || 0;
      }
      if (item instanceof CRRegion) {
        itemDist -= weights.regions || 0;
        if (itemDist < 0) {
          itemDist -= item.treeDepth;
        }
      }
      if (item.relativeWeight) {
        itemDist -= item.relativeWeight;
      }
      if (disqualify && disqualify(item.id)) {
        return;
      }
      if (itemDist < bestHitDist) {
        bestHit = item;
        bestHitDist = itemDist;
      }
    });
    if (bestHit) {
      if (bestHitDist <= 0) {
        return bestHit.id;
      }
    }
    return null;
  }

  // TODO: test this!
  resolveInRadiusWithSnapPositions (
    position,
    radius = 10,
    includePoints = true,
    includeLines = true,
    pointBias = 1,
    lineBias = 1
  ) {
    const hits = this.quadtree.get({
      x: position.x - radius,
      y: position.y - radius,
      w: radius * 2,
      h: radius * 2
    });
    const results = [];
    const visitedMultilineIDs = {};
    hits.forEach(item => {
      if (item instanceof CRPoint) {
        if (!includePoints) {
          return;
        }
        const itemDist = item.getDist(position);
        if (itemDist <= radius) {
          results.push({
            id: item.id,
            bias: pointBias,
            snapDistance: itemDist,
            snapPosition: item.point.clone(),
            snapOffset: item.point.clone().sub(position)
          });
        }
      }
      else if (item instanceof CRLine) {
        if (!includeLines) {
          return;
        }
        const restOfLine = this.idToEntity.get(item.id);
        if (Array.isArray(restOfLine)) {
          if (visitedMultilineIDs[item.id]) {
            return;
          }
          visitedMultilineIDs[item.id] = 1;
          let bestSubSnapDist = Infinity;
          let bestSubSnap = null;
          restOfLine.forEach(subItem => {
            const subSnap = subItem.getDistAndNearestPoint(position);
            if (subSnap[0] < bestSubSnapDist) {
              bestSubSnap = subSnap;
              bestSubSnapDist = subSnap[0];
            }
          });
          if (bestSubSnap && bestSubSnapDist <= radius) {
            results.push({
              id: item.id,
              bias: lineBias,
              snapDistance: bestSubSnap[0],
              snapPosition: bestSubSnap[1],
              snapOffset: bestSubSnap[2]
            });
          }
        }
        else {
          const snap = item.getDistAndNearestPoint(position);
          if (snap[0] <= radius) {
            results.push({
              id: item.id,
              bias: lineBias,
              snapDistance: snap[0],
              snapPosition: snap[1],
              snapOffset: snap[2]
            });
          }
        }
      }
    });
    results.sort((a, b) => {
      if (a.snapDistance * b.bias > b.snapDistance * a.bias) {
        return 1;
      }
      if (a.snapDistance * b.bias < b.snapDistance * a.bias) {
        return -1;
      }
      return 0;
    });
    return results;
  }

  checkCollisions (bbox, id) {
    const _doLinesHaveSameEndpoints = (lineA, lineB) => {
      return lineA.a.equals(lineB.a)
        || lineA.a.equals(lineB.b)
        || lineA.b.equals(lineB.a)
        || lineA.b.equals(lineB.b);
    };

    const _doesHitCollide = hit => {
      const bboxLineSegment = new sat.Polygon(
        new sat.Vector(),
        [
          new sat.Vector(bbox.min.x, bbox.min.y),
          new sat.Vector(bbox.max.x, bbox.max.y)
        ]);

      const hitLineSegment = new sat.Polygon(
        new sat.Vector(),
        [
          new sat.Vector(hit.a.x, hit.a.y),
          new sat.Vector(hit.b.x, hit.b.y)
        ]
      );

      return sat.testPolygonPolygon(bboxLineSegment, hitLineSegment);
    };
    const qtBBox = {
      x: bbox.min.x,
      y: bbox.min.y,
      w: bbox.max.x - bbox.min.x,
      h: bbox.max.y - bbox.min.y
    };
    const bboxLine = new CRLine(0, bbox.min, bbox.max);
    const rawHits = this.quadtree.get(qtBBox);
    const collisions = rawHits.filter(hit => {
      return hit instanceof CRLine
        && !_doLinesHaveSameEndpoints(hit, bboxLine)
        && _doesHitCollide(hit);
    });
    return { id, collisions };
  }
}

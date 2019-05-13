import debugDependency from "debug";
import { Vector2, Vector3, Ray, Plane } from "three";

const debug = debugDependency("st:fpc4:editor:lib:guide-snapping");

/**
 * Given a floor's entity map, produce guides
 */
function generateSnapGuides (entities) {
  const guides = [];
  entities.valueSeq().forEach(entity => {
    const entityId = entity.get("id");
    const entityType = entity.get("type");
    // for points, produce grid snaps
    if (entityType === "point") {
      const entityPos = entity.toVector2();
      guides.push({
        entityId,
        type: "grid",
        pos: entityPos,
        tangent: new Vector2(0, 1)
      });
      guides.push({
        entityId,
        type: "grid",
        pos: entityPos,
        tangent: new Vector2(1, 0)
      });
    }
    else if (entityType === "object") {
      const entityPos = new Vector2(
        entity.get("x"),
        entity.get("y")
      );
      guides.push({
        entityId,
        type: "grid",
        pos: entityPos,
        tangent: new Vector2(0, 1)
      });
      guides.push({
        entityId,
        type: "grid",
        pos: entityPos,
        tangent: new Vector2(1, 0)
      });
    }
    // for boundaries produce extension snaps
    else if (entityType === "boundary") {
      if (entity.get("arc")) {
        return;
      }
      const startPoint = entities.get(entity.get("start"));
      const endPoint = entities.get(entity.get("end"));
      if (!startPoint || !endPoint) {
        return;
      }
      const startPos = startPoint.toVector2();
      const endPos = endPoint.toVector2();
      const tangent = endPos.clone().sub(startPos);
      const boundaryLength = tangent.length();
      tangent.normalize();
      guides.push({
        entityId,
        type: "boundary",
        pos: startPos,
        tangent,
        boundaryLength
      });
      const normal = new Vector2(-tangent.y, tangent.x);
      guides.push({
        entityId,
        type: "boundaryNormal",
        pos: startPos,
        tangent: normal
      });
      guides.push({
        entityId,
        type: "boundaryNormal",
        pos: endPos,
        tangent: normal
      });
    }
  });
  return guides;
}

/**
 * Given a floor's entity map, a start point, and an optional boundary, produce
 * guides for use as snapping constraints
 */
function generatePointConstraintSnapGuides (entities, point, boundary = null) {
  const guides = [];
  const entityPos = point.toVector2();
  const pointId = point.get("id");
  guides.push({
    entityId: pointId,
    type: "grid",
    pos: entityPos,
    tangent: new Vector2(0, 1)
  });
  guides.push({
    entityId: pointId,
    type: "grid",
    pos: entityPos,
    tangent: new Vector2(1, 0)
  });
  if (boundary) {
    const startPoint = entities.get(boundary.get("start"));
    const endPoint = entities.get(boundary.get("end"));
    if (!startPoint || !endPoint) {
      return guides;
    }
    const startPos = startPoint.toVector2();
    const endPos = endPoint.toVector2();
    const tangent = endPos.clone().sub(startPos);
    tangent.normalize();
    const normal = new Vector2(-tangent.y, tangent.x);
    guides.push({
      entityId: pointId,
      type: "boundaryNormal",
      pos: entityPos,
      tangent: normal
    });
  }
  if (entities.get(pointId)) {
    const connectedBoundaries = entities.filter(e => (
      e.get("type") === "boundary" &&
      !e.get("arc") &&
      (e.get("start") === pointId || e.get("end") === pointId)
    ));
    connectedBoundaries.forEach(entity => {
      const entityId = entity.get("id");
      const startPoint = entities.get(entity.get("start"));
      const endPoint = entities.get(entity.get("end"));
      if (!startPoint || !endPoint) {
        return;
      }
      const startPos = startPoint.toVector2();
      const endPos = endPoint.toVector2();
      const tangent = endPos.clone().sub(startPos);
      const boundaryLength = tangent.length();
      tangent.normalize();
      const normal = new Vector2(-tangent.y, tangent.x);
      guides.push({
        entityId,
        type: "boundary",
        pos: entityPos,
        tangent,
        boundaryLength
      });
      guides.push({
        entityId,
        type: "boundaryNormal",
        pos: entityPos,
        tangent: normal
      });
    });
  }
  return guides;
}

/**
 * Given an array of guides, pick the best for a given position
 */
function getBestGuideSnap (guides, position) {
  let bestGuideCost = Infinity;
  let bestGuide = null;
  let bestGuideOffset = null;
  const offset = new Vector2();
  const tangent = new Vector2();
  for (let gi=0; gi<guides.length; gi++) {
    const guide = guides[gi];
    tangent.copy(guide.tangent);
    offset.copy(position).sub(guide.pos);
    const distanceAlongTangent = offset.dot(tangent);
    tangent.multiplyScalar(distanceAlongTangent);
    offset.sub(tangent);
    const offsetDist = offset.length();
    let offsetCost = offsetDist;
    if (guide.type === "point") {
      offsetCost += Math.abs(distanceAlongTangent) * 0.01;
    }
    else if (guide.type === "boundary") {
      offsetCost *= 0.5;
      offsetCost += Math.max(0, 0.02 * Math.min(
        distanceAlongTangent * -1,
        distanceAlongTangent - guide.boundaryLength
      ));
    }
    else if (guide.type === "boundaryNormal") {
      offsetCost *= 0.5;
      offsetCost += Math.abs(distanceAlongTangent) * 0.01;
    }
    if (offsetCost < bestGuideCost) {
      bestGuideCost = offsetCost;
      bestGuide = guide;
      bestGuideOffset = offset.clone();
    }
  }
  return [bestGuide, bestGuideOffset];
}

/**
 * Given an array of guides, pick the best for a given position and ray tangent
 */
function getBestGuideSnapConstrained (guides, position, tangent) {
  let bestGuideCost = Infinity;
  let bestGuide = null;
  let bestGuideOffset = null;
  const position3 = new Vector3().copy(position).setZ(0);
  const tangent3 = new Vector3().copy(tangent).setZ(0);
  const tangentRay = new Ray(
    tangent3.clone().multiplyScalar(-1000).add(position3),
    tangent3
  );
  const offset = new Vector2();
  const guidePosition3 = new Vector3();
  const guideNormal3 = new Vector3();
  const guideTangent = new Vector2();
  const guideTangentPlane = new Plane();
  const guideTangentPlaneIntersection = new Vector3();
  const intersect2 = new Vector2();
  for (let gi=0; gi<guides.length; gi++) {
    const guide = guides[gi];
    // skip guides that are too close to parallel
    const guideAlignment = Math.abs(tangent.dot(guide.tangent));
    if (guideAlignment > 0.95) {
      continue;
    }
    guideTangent.copy(guide.tangent);
    guideNormal3.x = -guide.tangent.y;
    guideNormal3.y = guide.tangent.x;
    guideNormal3.z = 0;
    guidePosition3.copy(guide.pos).setZ(0);
    guideTangentPlane.setFromNormalAndCoplanarPoint(
      guideNormal3,
      guidePosition3
    );
    // copy intersection coordinates to guideTangentPlaneIntersection or bail
    if (!tangentRay.intersectPlane(
      guideTangentPlane,
      guideTangentPlaneIntersection
    )) {
      continue;
    }
    // great - we've got our guide-tangent intersection with only minimal math
    intersect2.copy(guideTangentPlaneIntersection);
    // and now we've got an offset from the initial position!
    offset.copy(intersect2).sub(position).multiplyScalar(-1);
    // apply scoring logic, all that good stuff
    const offsetDist = offset.length();
    const distanceAlongTangent = offset.dot(guideTangent);
    let offsetCost = offsetDist * (1 + guideAlignment);
    if (guide.type === "point") {
      offsetCost += Math.abs(distanceAlongTangent) * 0.01;
    }
    else if (guide.type === "boundary") {
      offsetCost *= 0.5;
      offsetCost += Math.max(0, 0.02 * Math.min(
        distanceAlongTangent * -1,
        distanceAlongTangent - guide.boundaryLength
      ));
    }
    else if (guide.type === "boundaryNormal") {
      offsetCost *= 0.5;
      offsetCost += Math.abs(distanceAlongTangent) * 0.01;
    }
    if (offsetCost < bestGuideCost) {
      bestGuideCost = offsetCost;
      bestGuide = guide;
      bestGuideOffset = offset.clone();
    }
  }
  return [bestGuide, bestGuideOffset];
}

/**
 * Export a thing that can memoize guides based of a given floor
 */
export default class GuideSnapper {
  constructor () {
    this.floorEntities = null;
    this.guides = null;
  }

  /**
   * General-purpose guide snapping
   */
  getBestSnap (floor, position, maxDist = 20, snapToBoundary = null) {
    const floorEntities = floor.get("entities");
    if (this.floorEntities !== floorEntities) {
      debug("generating snapping guides");
      this.floorEntities = floorEntities;
      this.guides = generateSnapGuides(floorEntities);
    }

    let stage1Guide, stage1Offset;

    // if we passed in a boundary, treat it as the primary snap target
    if (snapToBoundary) {
      const [
        snapBoundPosition,
        snapBoundNormal
      ] = snapToBoundary.getAlignmentInfo(
        floorEntities,
        new Vector2().copy(position)
      );
      stage1Guide = {
        entityId: snapToBoundary.id,
        type: "boundary",
        pos: snapBoundPosition,
        tangent: new Vector2(-snapBoundNormal.y, snapBoundNormal.x),
        boundaryLength: snapToBoundary.getLength(floorEntities)
      };
      stage1Offset = new Vector2().add(position).sub(snapBoundPosition);
    }
    // otherwise, pick a snap target
    else {
      const bestGuideAndOffset = getBestGuideSnap(
        this.guides,
        position
      );
      stage1Guide = bestGuideAndOffset[0];
      stage1Offset = bestGuideAndOffset[1];
    }
    if (!stage1Guide) {
      return [];
    }
    const stage1Position = position.clone().sub(stage1Offset);
    const [stage2Guide, stage2Offset] = getBestGuideSnapConstrained(
      this.guides,
      stage1Position,
      stage1Guide.tangent
    );
    if (stage2Guide) {
      const stage2Position = stage1Position.clone().sub(stage2Offset);
      stage2Offset.add(stage1Offset);
      if (stage2Offset.length() <= maxDist) {
        return [[stage1Guide, stage2Guide], stage2Offset, stage2Position];
      }
    }
    if (stage1Offset.length() <= maxDist) {
      return [[stage1Guide], stage1Offset, stage1Position];
    }
    return [];
  }

  /**
   * Constrained snapping - forces constraint to a snap line and does not snap
   * to faraway objects, only vectors relative to the point
   */
  getPointConstrainedSnap (floor, startPoint, startBoundary = null, position, snapToBoundary = null) {
    const floorEntities = floor.get("entities");
    const guides = generatePointConstraintSnapGuides(floorEntities, startPoint, startBoundary);

    if (snapToBoundary) {
      const [
        snapBoundPosition,
        snapBoundNormal
      ] = snapToBoundary.getAlignmentInfo(
        floorEntities,
        new Vector2().copy(position)
      );
      const stage1Guide = {
        entityId: snapToBoundary.id,
        type: "boundary",
        pos: snapBoundPosition,
        tangent: new Vector2(-snapBoundNormal.y, snapBoundNormal.x),
        boundaryLength: snapToBoundary.getLength(floorEntities)
      };
      const stage1Offset = new Vector2().add(position).sub(snapBoundPosition);
      const stage1Position = position.clone().sub(stage1Offset);
      const [stage2Guide, stage2Offset] = getBestGuideSnapConstrained(
        guides,
        stage1Position,
        stage1Guide.tangent
      );
      const stage2Position = stage1Position.clone().sub(stage2Offset);
      stage2Offset.add(stage1Offset);
      return [[stage1Guide, stage2Guide], stage2Offset, stage2Position];
    }

    const [guide, offset] = getBestGuideSnap(guides, position);
    return [[guide], offset, position.clone().sub(offset)];

  }
}

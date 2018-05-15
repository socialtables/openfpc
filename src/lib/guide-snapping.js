import debugDependency from "debug";
import { Vector2, Vector3, Ray, Plane } from "three";

const debug = debugDependency("openfpc:editor:lib:guide-snapping");

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
    }
  });
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
  getBestSnap (floor, position, maxDist = 20) {
    const floorEntities = floor.get("entities");
    if (this.floorEntities !== floorEntities) {
      debug("generating snapping guides");
      this.floorEntities = floorEntities;
      this.guides = generateSnapGuides(floorEntities);
    }
    const [stage1Guide, stage1Offset] = getBestGuideSnap(
      this.guides,
      position
    );
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
}

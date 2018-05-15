import { Record, isImmutable } from "immutable";
import shortid from "shortid";
import {
  Vector3,
  Vector2
} from "three";
import {
  interpolateArcPointsByConstraints,
  computeArcRadius,
  computeArcAngle
} from "../lib/floor-geometry";

// boundary type
export default class Boundary extends Record ({
  id: null,
  type: "boundary",
  boundaryType: "wall",
  start: null,
  end: null,
  arc: 0
}) {
  constructor(props={}) {
    super(
      isImmutable(props) ?
        props
        .set("id", shortid.generate())
        .set("boundaryType", props.get("boundaryType") || props.get("type"))
        .delete("type") :
        Object.assign({}, props, {
          id: shortid.generate(),
          type: "boundary",
          boundaryType: props.boundaryType || props.type
        })
    );
  }
  reassignEndpoints (start, end) {
    if (start === this.get("start") && end === this.get("end")) {
      return this;
    }
    return this.merge({
      id: shortid.generate(),
      start: start || this.get("start"),
      end: end || this.get("end")
    });
  }
  // gets arc points (as Vector3s === questionable)
  getArcPoints (pointMap) {
    const arcHeight = this.get("arc");
    if (!arcHeight) {
      return [];
    }
    const startPoint = pointMap.get(this.get("start"));
    const endPoint = pointMap.get(this.get("end"));
    if (!startPoint || !endPoint) {
      throw new Error("missing points, universe may be broken");
    }
    const startPoint3 = new Vector3(startPoint.get("x"), startPoint.get("y"), 0);
    const endPoint3 = new Vector3(endPoint.get("x"), endPoint.get("y"), 0);
    const arcPoints = interpolateArcPointsByConstraints(
      startPoint3,
      endPoint3,
      arcHeight,
      24,
      Math.PI * 0.25
    );
    arcPoints.forEach(p => p.setZ(0));
    return arcPoints;
  }
  getLength (pointMap) {
    const arc = this.get("arc");
    const startPoint = pointMap.get(this.get("start"));
    const endPoint = pointMap.get(this.get("end"));
    if (arc === 0) {
      return startPoint.toVector2().clone().sub(endPoint.toVector2()).length();
    }
    const chordLength = startPoint.toVector2().clone().sub(endPoint.toVector2()).length();
    const radius = computeArcRadius(chordLength, Math.abs(arc));
    const theta = computeArcAngle(radius, Math.abs(arc));
    return radius * theta;
  }
  /**
   * @param {Map} pointMap - map from ID to points for endpoint lookup
   * @param {Object} position - position object with X, Y attributes
   * @returns {[Vector2, Vector2, number]} - returns the nearest point, the
   * normal vector from that point, and it's relative position along the boundary
   */
  getAlignmentInfo (pointMap, position) {
    const pos = isImmutable(position) ?
      new Vector2(position.get("x"), position.get("y")) :
      position;
    const startPoint = pointMap.get(this.get("start"));
    const endPoint = pointMap.get(this.get("end"));
    const startPos = new Vector2(startPoint.get("x"), startPoint.get("y"));
    const endPos = new Vector2(endPoint.get("x"), endPoint.get("y"));
    const posDelta = pos.clone().sub(startPos);
    const endDelta = endPos.clone().sub(startPos);
    const arcHeight = this.get("arc");

    // if arc height is in play, we're going to be doing some math
    if (arcHeight) {
      // have your copy books ready
      const chordLength = endDelta.length();
      const chordVector =	endDelta.normalize();
      const arcRadius = computeArcRadius(chordLength, arcHeight);
      const sagittaVector = new Vector2(-chordVector.y, chordVector.x);
      // compute center, normal vector that points to it
      const centerPos = startPos.clone()
      .add(chordVector.clone().multiplyScalar(chordLength/2))
      .add(sagittaVector.clone().multiplyScalar(arcHeight - arcRadius));
      const normal = pos.clone().sub(centerPos).normalize();
      const closestPos = normal.clone()
      .multiplyScalar((arcHeight > 0) ? arcRadius : -arcRadius)
      .add(centerPos);
      // now compute the angle along the curve that this vector represents
      const tangent = new Vector2(-normal.y, normal.x);
      const arcAngle = computeArcAngle(arcRadius, arcHeight);
      const startPosRelativeToCenter = startPos.clone().sub(centerPos);
      let startPosAngle = new Vector2(
        normal.dot(startPosRelativeToCenter),
        tangent.dot(startPosRelativeToCenter)
      ).angle();
      if (arcHeight < 0) {
        startPosAngle = (Math.PI * 2) - startPosAngle;
      }
      const distAlongArc = startPosAngle / arcAngle;
      // and return everything
      return [closestPos, normal, distAlongArc];
    }
    // if arcs are not involved, do a more sensible amount of math
    const normal = new Vector2(-endDelta.y, endDelta.x).normalize();
    const dist = posDelta.dot(normal);
    const closestPos = pos.clone().sub(normal.clone().multiplyScalar(dist));
    const distAlongTangent = closestPos.clone().sub(startPos).length() /
      endDelta.length();
    return [closestPos, normal, distAlongTangent];
  }
  getPositionAlongBoundary (pointMap, bias = 0.5) {
    const startPoint = pointMap.get(this.get("start"));
    const endPoint = pointMap.get(this.get("end"));
    const startPos = new Vector2(startPoint.get("x"), startPoint.get("y"));
    const endPos = new Vector2(endPoint.get("x"), endPoint.get("y"));
    const endDelta = endPos.clone().sub(startPos);
    const arcHeight = this.get("arc");
    // if arc height, do math
    if (arcHeight) {
      // have your copy books ready
      const chordLength = endDelta.length();
      const chordVector =	endDelta.normalize();
      const arcRadius = computeArcRadius(chordLength, arcHeight);
      const sagittaVector = new Vector2(-chordVector.y, chordVector.x);
      // compute center, normal vector that points to it
      const centerPos = startPos.clone()
      .add(chordVector.clone().multiplyScalar(chordLength/2))
      .add(sagittaVector.clone().multiplyScalar(arcHeight - arcRadius));
      // computer arc angle * bias, and then add it to the start point's angle
      let angleOffset = computeArcAngle(arcRadius, arcHeight) * bias;
      if (arcHeight < 0) {
        angleOffset = (Math.PI * 2) - angleOffset;
      }
      const startAngle = startPos.clone().sub(centerPos).angle();
      const angle = startAngle - angleOffset;
      const normal = new Vector2(Math.cos(angle), Math.sin(angle));
      if (arcHeight < 0) {
        normal.multiplyScalar(-1);
      }
      // return position, normal
      return [
        normal.clone().multiplyScalar(arcRadius).add(centerPos),
        normal
      ];
    }
    // return position + endpoint delta * bias, normal
    return [
      endDelta.clone().multiplyScalar(bias).add(startPoint),
      new Vector2(-endDelta.y, endDelta.x).normalize()
    ];
  }
  // produces a mutation, a new boundary, and a bias representing the act of
  // splitting this segment at a given point. arcs are the hard part as always.
  splitAtPoint (pointMap, splitPoint) {
    const startPos = pointMap.get(this.get("start")).toVector2();
    const endPos = pointMap.get(this.get("end")).toVector2();
    const endDelta = endPos.clone().sub(startPos);
    const tangent = endDelta.clone().normalize();
    const splitPos = splitPoint.toVector2();
    const splitDelta = splitPos.clone().sub(startPos);
    const arcHeight = this.get("arc");
    // if arc height is a factor, we need to know what new arc heights the two
    // resulting segments should have
    if (arcHeight) {
      const chordLength = endDelta.length();
      const chordVector =	endDelta.normalize();
      const arcRadius = computeArcRadius(chordLength, arcHeight);
      const sagittaVector = new Vector2(-chordVector.y, chordVector.x);
      // compute center, normal vector that points to it
      const centerPos = startPos.clone()
      .add(chordVector.clone().multiplyScalar(chordLength/2))
      .add(sagittaVector.clone().multiplyScalar(arcHeight - arcRadius));
      const splitNormal = splitPos.clone().sub(centerPos).normalize();
      const splitTangent = new Vector2(-splitNormal.y, splitNormal.x);
      const arcAngle = computeArcAngle(arcRadius, arcHeight);
      const startPosRelativeToCenter = startPos.clone().sub(centerPos);
      let startPosAngle = new Vector2(
        splitNormal.dot(startPosRelativeToCenter),
        splitTangent.dot(startPosRelativeToCenter)
      ).angle();
      if (arcHeight < 0) {
        startPosAngle = (Math.PI * 2) - startPosAngle;
      }
      // from there, we know the arc angles for each new segment
      const bias = startPosAngle / arcAngle;
      const angleA = Math.abs(startPosAngle);
      const angleB = Math.abs(arcAngle) - angleA;
      const arcHeightA = arcRadius * (1 - Math.cos(angleA / 2));
      const arcHeightB = arcRadius * (1 - Math.cos(angleB / 2));
      return [
        new Boundary({
          start: this.get("start"),
          end: splitPoint.get("id"),
          arc: arcHeightA,
          boundaryType: this.get("boundaryType")
        }),
        new Boundary({
          start: splitPoint.get("id"),
          end: this.get("end"),
          arc: arcHeightB,
          boundaryType: this.get("boundaryType")
        }),
        bias
      ];
    }
    // easy mode - no arc height calculation, just relative bias sampling
    const bias = splitDelta.dot(tangent) / endDelta.length();
    return [
      new Boundary({
        start: this.get("start"),
        end: splitPoint.get("id"),
        boundaryType: this.get("boundaryType")
      }),
      new Boundary({
        start: splitPoint.get("id"),
        end: this.get("end"),
        boundaryType: this.get("boundaryType")
      }),
      bias
    ];
  }
  static fromJS(raw) {
    return new Boundary(raw);
  }
  isEntityType (entityType) {
    if (Array.isArray(entityType)) {
      return (
        (this.get("type") === entityType[0]) &&
        (this.get("boundaryType") === entityType[1])
      );
    }
    return this.get("type") === entityType;
  }
}

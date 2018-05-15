import { Record, List, isImmutable } from "immutable";
import shortid from "shortid";
import {
  Vector3,
  Vector2
} from "three";

// permanent object type
export default class PermanentObject extends Record({
  id: null,
  type: "object",
  objectType: "unknown",
  x: 0,
  y: 0,
  width: 0,
  height: 0,
  rotation: 0,
  isFlippedX: false,
  attachedToBoundary: null,
  attachedToBoundaryPos: 0,
  attachedToRegions: new List()
}) {
  constructor(props={}) {
    super(
      isImmutable(props) ?
        props
        .set("id", shortid.generate())
        .set("objectType", props.get("type"))
        .set("src", props)
        .delete("type") :
        Object.assign({}, props, {
          id: shortid.generate(),
          type: "object",
          objectType: props.type,
          src: props
        })
    );
  }
  static fromJS(raw) {
    return new PermanentObject(raw);
  }
  attachToBoundary (boundary, pointMap, snap = true, rotate = true) {
    const [
      nearestPoint,
      normal,
      bias
    ] = boundary.getAlignmentInfo(pointMap, this);
    const changes = {
      attachedToBoundary: boundary.get("id"),
      attachedToBoundaryPos: bias
    };
    if (snap) {
      changes.x = nearestPoint.x;
      changes.y = nearestPoint.y;
    }
    if (rotate) {
      const currentTheta = this.get("rotation") * Math.PI / 180 - Math.PI / 2;
      const currentNormal = new Vector2(
        Math.cos(currentTheta),
        Math.sin(currentTheta)
      );
      changes.rotation = normal.angle() * 180 / Math.PI + 90;
      if (currentNormal.dot(normal) < 0) {
        changes.rotation = (changes.rotation + 180) % 360;
      }
    }
    return this.merge(changes);
  }
  maintainAttachment (entities, rotate = true) {
    const attachedToBoundary = this.get("attachedToBoundary");
    if (!attachedToBoundary) {
      return this;
    }
    const boundary = entities.get(attachedToBoundary);
    const bias = this.get("attachedToBoundaryPos");
    const [pos, normal] = boundary.getPositionAlongBoundary(entities, bias);
    const changes = {
      x: pos.x,
      y: pos.y
    };
    if (rotate) {
      const currentTheta = this.get("rotation") * Math.PI / 180 - Math.PI / 2;
      const currentNormal = new Vector2(
        Math.cos(currentTheta),
        Math.sin(currentTheta)
      );
      changes.rotation = normal.angle() * 180 / Math.PI + 90;
      if (currentNormal.dot(normal) < 0) {
        changes.rotation = (changes.rotation + 180) % 360;
      }
    }
    return this.merge(changes);
  }
  alignToBoundary (boundary, pointMap, snapPosition = true, assignBias = true) {
    const [nearestPoint, normal, bias] = boundary.getAlignmentInfo(pointMap, this);
    const currentTheta = this.get("rotation") * Math.PI / 180 - Math.PI / 2;
    const currentNormal = new Vector2(
      Math.cos(currentTheta),
      Math.sin(currentTheta)
    );
    let alignedRotation = normal.angle() * 180 / Math.PI + 90;
    if (currentNormal.dot(normal) < 0) {
      alignedRotation = (alignedRotation + 180) % 360;
    }
    let nxt = this;
    if (snapPosition) {
      nxt = nxt.merge({
        x: nearestPoint.x,
        y: nearestPoint.y,
        rotation: alignedRotation
      });
    }
    else {
      nxt = nxt.set("rotation", alignedRotation);
    }
    if (assignBias) {
      nxt = nxt.set("attachedToBoundaryPos", bias);
    }
    return nxt;
  }
  applyMatrix4 (mtx) {
    const point3 = new Vector3(this.get("x"), this.get("y"), 0);
    point3.applyMatrix4(mtx);
    return this.merge({
      x: point3.x,
      y: point3.y
    });
  }
  isEntityType (entityType) {
    if (Array.isArray(entityType)) {
      return (
        (this.get("type") === entityType[0]) &&
        (this.get("objectType") === entityType[1])
      );
    }
    return this.get("type") === entityType;
  }
}

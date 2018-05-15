import { Vector2, Vector3 } from "three";
import { isImmutable, Record } from "immutable";
import shortid from "shortid";

// point type
export default class Point extends Record({
  id: null,
  type: "point",
  x: 0,
  y: 0
}) {
  constructor(props={}) {
    super(
      isImmutable(props) ?
        props.set("id", shortid.generate()) :
        Object.assign({}, props, { id: shortid.generate() })
    );
  }
  static fromJS(raw) {
    return new Point(raw);
  }
  applyMatrix4(mtx) {
    const point3 = new Vector3(this.get("x"), this.get("y"), 0);
    point3.applyMatrix4(mtx);
    return this.merge({
      x: point3.x,
      y: point3.y
    });
  }
  toVector2 () {
    return new Vector2(this.get("x"), this.get("y"));
  }
  toVector3 () {
    return new Vector3(this.get("x"), this.get("y"), 0);
  }
  to2DArr () {
    return [this.get("x"), this.get("y")];
  }
  isEntityType (entityType) {
    return this.get("type") === entityType;
  }
}

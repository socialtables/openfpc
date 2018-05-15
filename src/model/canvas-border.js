import { Record, isImmutable } from "immutable";
import shortid from "shortid";

export default class CanvasBorder extends Record({
  id: null,
  type: "canvas-border",
  centerX: 0,
  centerY: 0,
  width: 0,
  height: 0
}) {
  constructor(props={}) {
    super(
      isImmutable(props) ?
        props
        .set("id", shortid.generate())
        .set("src", props)
        .delete("type") :
        Object.assign({}, props, {
          id: shortid.generate(),
          type: "canvas-border",
          src: props
        })
    );
  }
  static fromJS(raw) {
    return new CanvasBorder(raw);
  }
  isEntityType (entityType) {
    return this.get("type") === entityType;
  }
}

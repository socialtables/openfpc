import { Record, isImmutable } from "immutable";
import shortid from "shortid";

export default class BackgroundImage extends Record({
  id: null,
  type: "background",
  url: null,
  centerX: 0,
  centerY: 0,
  width: 0,
  height: 0,
  rotation: null,
  autoSizeOnLoad: null
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
          type: "background",
          src: props
        })
    );
  }
  static fromJS(raw) {
    return new BackgroundImage(raw);
  }
  isEntityType (entityType) {
    return this.get("type") === entityType;
  }
}

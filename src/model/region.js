import { Record, List, isImmutable } from "immutable";
import shortid from "shortid";

export default class Region extends Record({
  id: null,
  type: "region",
  perimeterBoundaries: new List(),
  interiorBoundaries: new List(),
  holes: new List(),
  parent: null
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
          type: "region",
          src: props
        })
    );
  }
  static fromJS(raw) {
    return new Region(raw);
  }
  getPerimeterLoopPointOrder (pointBoundMap, includeArcs = false) {
    return this.getPointLoop(
      this.get("perimeterBoundaries"),
      pointBoundMap,
      includeArcs
    );
  }
  getNestDepth (otherRegions, l=0) {
    if (l >= 100) {
      return 100;
    }
    else if (this.get("parent")) {
      const parent = otherRegions.get(this.get("parent"));
      if (parent) {
        return parent.getNestDepth(otherRegions, l+1) + 1;
      }
    }
    else {
      return 1;
    }
  }
  getHolePointOrders (pointBoundMap, includeArcs = false) {
    return this.get("holes")
    .toJS()
    .map(h => this.getPointLoop(h, pointBoundMap, includeArcs));
  }
  getPointLoop (boundIDArr, pointBoundMap, includeArcs = false) {
    if (isImmutable(boundIDArr)) {
      return this.getPointLoop(boundIDArr.toJS(), pointBoundMap);
    }
    const lastBoundID = boundIDArr[boundIDArr.length - 1];
    const firstBoundID = boundIDArr[0];
    const lastBound = pointBoundMap.get(lastBoundID);
    const firstBound = pointBoundMap.get(firstBoundID);
    // bad, but better than crashing everything
    if (!firstBound || !lastBound) {
      console.error("missing region points!"); // eslint-disable-line no-console
      return [];
    }
    const lastBoundStart = lastBound.get("start");
    const lastBoundEnd = lastBound.get("end");
    const firstBoundStart = firstBound.get("start");
    const firstBoundEnd = firstBound.get("end");
    let prevBoundEnd = lastBoundEnd;
    if (
      (prevBoundEnd !== firstBoundStart) &&
      (prevBoundEnd !== firstBoundEnd)
    ) {
      prevBoundEnd = lastBoundStart;
    }
    const pointArr = [];
    for (let i = 0; i < boundIDArr.length; i++) {
      pointArr.push(prevBoundEnd);
      const boundID = boundIDArr[i];
      const bound = pointBoundMap.get(boundID);
      // bad, but better than crashing everything
      if (!bound) {
        console.error("missing region points!"); // eslint-disable-line no-console
        return [];
      }
      const boundStart = bound.get("start");
      const boundEnd = bound.get("end");
      if (prevBoundEnd === boundStart) {
        prevBoundEnd = boundEnd;
        if (includeArcs) {
          pointArr.push(bound.getArcPoints(pointBoundMap));
        }
      }
      else {
        prevBoundEnd = boundStart;
        if (includeArcs) {
          pointArr.push(bound.getArcPoints(pointBoundMap).reverse());
        }
      }
    }
    return pointArr;
  }
  isEntityType (entityType) {
    return this.get("type") === entityType;
  }
}

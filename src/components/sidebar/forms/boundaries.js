import { Map } from "immutable";
import BoundaryTypeDropdown from "../boundary-type-dropdown";
import { modifyEntities } from "../../../actions/floor-actions";

import NumberInput from "../../shared/number-input";
import Slider from "../../shared/slider";

const NEAR_ZERO = 5;

function formatFloat (num, precision=2) {
  return num ? +parseFloat(num).toFixed(precision) : num;
}

export function BoundaryEditor ({
  entities,
  selectedEntities,
  floorScale = 1
}) {
  const boundary = selectedEntities.first();
  if (!boundary) {
    return null;
  }
  const length = formatFloat(boundary.getLength(entities) * floorScale);

  return <div className="form-group">
    <label>Length</label>
    <NumberInput
      value={length}
      usesDecimals={true}
      disabled={true}
    />
  </div>;
}

export function BoundaryArcEditor ({ dispatch, selectedEntities }) {
  const isNearZero = num => num <= NEAR_ZERO && num >= -NEAR_ZERO;
  let totalArcHeight = 0;
  let totalBoundCount = 0;
  const boundSeq = selectedEntities.valueSeq().filter(b => b.type === "boundary");
  boundSeq.forEach(b => {
    totalArcHeight += b.get("arc") || 0;
    totalBoundCount++;
  });
  let avgArc = totalArcHeight / totalBoundCount;
  if (isNaN(avgArc)) {
    avgArc = 0;
  }
  let min = Math.min(-100, avgArc);
  let max = Math.max(100, avgArc);

  function onChange(shouldSnap, e){
    const targetArc = Number(e.target.value);
    const boundMap = {};
    boundSeq.forEach(b => {
      const boundArcDiff = (b.get("arc") || 0) - avgArc;
      let arc = targetArc + boundArcDiff;
      if (shouldSnap){
        arc = isNearZero(arc) ? 0 : arc;
      }
      boundMap[b.get("id")] = b.set("arc", arc);
    });
    dispatch(modifyEntities(new Map(boundMap)));
  }

  return <div className="form-group">
    <label>Arc</label>
    <Slider
      min={min}
      max={max}
      step={1}
      onChange={onChange.bind(this, true)}
      value={avgArc} />
    <label>Arc Height</label>
    <NumberInput
      value={totalArcHeight}
      min={min}
      max={max}
      onChange={onChange.bind(this, false)}
    />
  </div>;
}

export function BoundaryTypeEditor ({ dispatch, selectedEntities }) {
  const boundTypeMap = {};
  selectedEntities.forEach(e => {
    if (e.get("type") === "boundary") {
      boundTypeMap[e.get("boundaryType")] = 1;
    }
  });
  const multipleTypes = Object.keys(boundTypeMap).length > 1;
  const currentType = multipleTypes ? "" : Object.keys(boundTypeMap)[0];
  function onChange(selectedType) {
    dispatch(modifyEntities(selectedEntities.map(e => (
      e.get("type") === "boundary" ? e.set("boundaryType", selectedType) : e
    ))));
  }
  return <div className="form-group">
    <label>Boundary Type</label>
    <BoundaryTypeDropdown
      onChange={onChange}
      value={currentType}
      options={[
        { text: "Wall", value: "wall"},
        { text: "Air Wall", value: "air-wall"},
        { text: "Railing", value: "railing"},
        { text: "Border", value: "border"},
        { text: "Stairs", value: "stairs"},
        { text: "Dimension Line", value: "dimension-line"},
        { text: "Object", value: "object"}
      ]}
    />
  </div>;
}

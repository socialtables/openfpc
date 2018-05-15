import { modifyEntities } from "../../../actions/floor-actions";
import NumberInput from "../../shared/number-input";
import DegreesInput from "../../shared/degrees-input";
import Button from "../../shared/button";

const DECIMAL_PRECISION = 2;
const precisionMult = Math.pow(10, DECIMAL_PRECISION);

function objectTypeFields (objectType) {
  switch (objectType) {
  case "door":
    return ["x", "y", "width", "rotation", "isFlippedX"];
  case "double-door":
    return ["x", "y", "width", "rotation"];
  case "column":
    return ["x", "y", "width", "height", "rotation"];
  case "round-column":
    return ["x", "y", "width"];
  case "electric-outlet":
    return ["x", "y", "width"];
  case "window":
    return ["x", "y", "rotation", "width", "elevation"];
  case "rigging":
    return ["x", "y", "width"];
  default:
    return [];
  }
}

const schema = {
  "x": "integer",
  "y": "integer",
  "width": "float",
  "height": "float",
  "rotation": "degrees",
  "elevation": "integer",
  "isFlippedX": "boolean"
};

const isMeasurement = {
  width: true,
  height: true
};

function formatFloat(num, precision=2){
  return num ? +parseFloat(num).toFixed(precision) : num;
}

function isNumeric(field){
  return (schema[field] === "integer" || schema[field] === "float");
}

function onChangeHelper (entity, field, dispatch, floorScale=1) {
  return e => {
    let val = typeof e === "object" ? e.target.value : e;
    val = field === "isFlippedX" ? !entity.isFlippedX : ((val && isNumeric(field)) ? +val : val);
    if (isMeasurement[field] && floorScale) {
      val /= floorScale;
    }
    const updateMap = {};
    updateMap[entity.get("id")] = entity.merge({ [field]: val });
    dispatch(modifyEntities(updateMap));
  };
}

export default function ObjectEditor ({
  dispatch,
  selectedEntities,
  floorScale = 1
  /* floorUnits = IMPERIAL TODO: make it easier to pass in suffixes to input */
}) {
  const entity = selectedEntities.first();
  if (!entity) {
    return null;
  }

  const jsEntity = entity.toJS();
  jsEntity.width = (jsEntity.width > 0 ? formatFloat(jsEntity.width) : 1);
  jsEntity.height = (jsEntity.height > 0 ? formatFloat(jsEntity.height) : 1);
  jsEntity.x = Math.round(jsEntity.x);
  jsEntity.y = Math.round(jsEntity.y);
  jsEntity.isFlippedX = jsEntity.isFlippedX || false;

  // apply real-world scaling multiplier
  Object.keys(jsEntity).forEach(fk => {
    if (isMeasurement[fk]) {
      jsEntity[fk] *= floorScale;
      jsEntity[fk] = Math.round(jsEntity[fk] * precisionMult) / precisionMult;
    }
  });

  return <form
    className="boundary-obj-edit-panel"
  >
    {
      objectTypeFields(jsEntity.objectType).map((field, i) => {
        const fieldType = schema[field];
        const onChange = onChangeHelper(
          entity,
          field,
          dispatch,
          floorScale
        );
        if (fieldType === "boolean"){
          return <div className="form-group" key={i} style={{"marginTop": 24}}>
            <Button
              text="Flip"
              onClick={onChange}
              preventDefault={true}
            />
          </div>;
        }
        return <div className="form-group" key={i}>
          <label>
            {field.charAt(0).toUpperCase() + field.substr(1)}
          </label>
          {fieldType === "degrees" &&
            <DegreesInput
              value={jsEntity.rotation}
              disabled={false}
              onChange={onChange}
              onBlur={onChange}
            />
          }
          { (fieldType === "float" || fieldType === "integer") &&
            <NumberInput
              key={i}
              name={`${jsEntity.objectType}-${field}`}
              value={jsEntity[field]}
              onBlur={onChange}
              onChange={onChange}
              usesDecimals={fieldType === "float" ? true : false}
            />
          }
        </div>;
      })
    }
  </form>;
}

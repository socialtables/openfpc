import { Component } from "react";
import { connect } from "react-redux";
import { Vector3 } from "three";
import { Scale } from "../components/icons";
import { BaseButton } from "./base";
import {
  setFloorScale
} from "../actions/floor-actions";
import { selectTool } from "../actions/ui-actions";

import {
  ADJUST_SCALE_TOOL_NAME,
  SELECT_TOOL_NAME
} from "../constants/tools";
import {
  IMPERIAL_INCHES,
  METRIC,
  IMPERIAL_SUFFIX,
  METRIC_SUFFIX
} from "../constants";

const TOOL_NAME = ADJUST_SCALE_TOOL_NAME;
const ToolButton = BaseButton(TOOL_NAME);

function _preventViewportMousedown(e) {
  e.stopPropagation();
  //e.preventDefault();
  return false;
}

function _mapStateToProps () {
  return {};
}

function _formatFloat (num, precision=2) {
  return num ? +parseFloat(num).toFixed(precision) : num;
}

class AdjustScaleOverlayRaw extends Component {
  constructor (props) {
    super (props);
    this.state = {
      userSuppliedLengthValue: 0,
      userSuppliedValueValid: false
    };
  }
  _onUserScaleChanged (e) {
    e.preventDefault();
    const userSuppliedLengthValue = e.target.value;
    let userSuppliedValueValid = false;
    if (userSuppliedLengthValue && `${Number(userSuppliedLengthValue)}` === `${userSuppliedLengthValue}`) {
      userSuppliedValueValid = true;
    }
    this.setState({
      userSuppliedLengthValue,
      userSuppliedValueValid
    });
  }
  _onUserScaleSubmit (e) {
    e.preventDefault();
    const { viewport, dispatch } = this.props;
    const { entities } = viewport.props.floor;
    const {
      userSuppliedLengthValue,
      userSuppliedValueValid
    } = this.state;
    let actualLength = 0;
    const bound = this._getSelectedBoundary();
    if (bound) {
      actualLength = bound.getLength(entities);
    }
    if (userSuppliedValueValid && actualLength) {
      this.setState({
        userSuppliedLengthValue: "",
        userSuppliedValueValid: false
      });
      dispatch(setFloorScale(
        Number(userSuppliedLengthValue) / actualLength
      ));
      dispatch(selectTool(SELECT_TOOL_NAME));
    }
  }
  _getSelectedBoundary () {
    const { floor } = this.props.viewport.props;
    const { entities, selection } = floor;
    const boundaries = entities.valueSeq().filter(e => (
      (e.get("type") === "boundary") &&
      selection.get(e.get("id"))
    ));
    if (boundaries.count() >= 1) {
      return boundaries.first();
    }

    return null;

  }
  render () {
    const { viewport } = this.props;
    const { entities, scale = 1, units } = viewport.props.floor;
    const selectedBound = this._getSelectedBoundary();
    if (!selectedBound) {
      return null;
    }
    const {
      userSuppliedLengthValue,
      userSuppliedValueValid
    } = this.state;

    // get exact length
    const selectedBoundaryLength = selectedBound.getLength(entities) * scale;

    // get centerpoint
    const arc = selectedBound.get("arc") || 0;
    const startPoint = entities.get(selectedBound.get("start"));
    const endPoint = entities.get(selectedBound.get("end"));
    const start3 = new Vector3().copy(startPoint).setZ(0);
    const end3 = new Vector3().copy(endPoint).setZ(0);
    const center3 = end3.clone().add(start3).multiplyScalar(0.5);
    const delta3 = end3.clone().sub(start3);
    const normal3 = new Vector3(-delta3.y, delta3.x, 0).normalize();
    const centerWithArc3 = normal3.multiplyScalar(arc).add(center3);
    const centerWithArc2 = viewport._resolveLocation2(centerWithArc3);

    // add units of measurement
    const suffix = " " + ({
      [IMPERIAL_INCHES]: IMPERIAL_SUFFIX,
      [METRIC]: METRIC_SUFFIX
    }[units] || IMPERIAL_SUFFIX);

    // render updater overlay
    return <div
      className="adjust-scale-overlay"
      style={{
        left: centerWithArc2.x,
        top: centerWithArc2.y
      }}
      onMouseDown={_preventViewportMousedown}
    >
      <form onSubmit={(e) => this._onUserScaleSubmit(e)}>
        <label>Length</label>
        <div className="adjust-scale-overlay__input">
          <input
            type="text"
            value={userSuppliedLengthValue || ""}
            onChange={e => this._onUserScaleChanged(e)}
            placeholder={_formatFloat(selectedBoundaryLength) + suffix}
          />
          <button type="submit" disabled={!userSuppliedValueValid}>Scale</button>
        </div>
      </form>
    </div>;
  }
}

const AdjustScaleOverlay = connect(_mapStateToProps)(AdjustScaleOverlayRaw);

export default class AdjustScaleTool {
  constructor () {
    this.name = TOOL_NAME;
    this.toolButton = (
      <ToolButton
        dataTip="Scale"
      >
        <Scale />
      </ToolButton>
    );
    this.enableClickSelect = true;
    this.disableMutatuonKeyEvents = true;
  }
  getViewportOverlay (props) {

    // don't render dots for empty selections
    return <AdjustScaleOverlay {...props}/>;
  }
}
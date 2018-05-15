import { Component } from "react";
import { Map } from "immutable";
import { Vector2, Vector3 } from "three";
import { BaseButton } from "./base";
import Draggable from "react-draggable";
import {
  transformTooltopDrag,
  transformTooltopDragComplete
} from "../actions/ui-actions";
import {
  updatePendingEntities,
  applyPendingUpdate
} from "../actions/floor-actions";
import { ARC_TOOL_NAME } from "../constants/tools";

const TOOL_NAME = ARC_TOOL_NAME;
const ToolButton = BaseButton(TOOL_NAME);

function _preventViewportMousedown(e) {
  e.stopPropagation();
  e.preventDefault();
  return false;
}

class ArcOverlay extends Component {
  constructor (props) {
    super(props);
    this.state = {
      dragging: false,
      draggingBoundary: null,
      dragOrigin: null,
      dragNormal: null
    };
  }
  _onHandleDragStart (boundary, center) {
    const { floor, viewport } = this.props;
    const entities = floor.get("entities");
    const startPoint = entities.get(boundary.get("start"));
    const endPoint = entities.get(boundary.get("end"));
    const startPos3 = new Vector3().copy(startPoint).setZ(0);
    const endPos3 = new Vector3().copy(endPoint).setZ(0);
    const startPos2 = viewport._resolveLocation2(startPos3);
    const endPos2 = viewport._resolveLocation2(endPos3);

    const delta3 = endPos3.clone().sub(startPos3);
    const delta2 = endPos2.clone().sub(startPos2);

    const normal2 = new Vector2(-delta2.y, delta2.x).normalize();
    const ratio = delta3.length() / (delta2.length() || 1);

    this.setState({
      dragging: true,
      draggingBoundary: boundary,
      dragOrigin: center,
      dragNormal: normal2,
      dragPixelRatio: ratio
    });
  }
  _onHandleDrag (pos) {
    const { dispatch } = this.props;
    const {
      draggingBoundary,
      dragOrigin,
      dragNormal,
      dragPixelRatio
    } = this.state;
    const posDelta = new Vector2().copy(pos).sub(dragOrigin);
    const posDist = posDelta.dot(dragNormal) * dragPixelRatio;
    const boundaryUpdate = {};
    boundaryUpdate[draggingBoundary.get("id")] = draggingBoundary.set("arc", posDist);
    dispatch(transformTooltopDrag());
    dispatch(updatePendingEntities(new Map(boundaryUpdate)));
  }
  _onHandleDragStop () {
    const { dispatch } = this.props;
    this.setState({
      dragging: false,
      draggingBoundary: null,
      dragOrigin: null,
      dragNormal: null,
      dragPixelRatio: null
    });
    dispatch(transformTooltopDragComplete());
    dispatch(applyPendingUpdate());
  }
  render () {
    const { viewport, floor } = this.props;
    const selection = floor.get("selection");
    const entities = floor.get("entities");
    const boundaries = entities.valueSeq().filter(e => (
      (e.get("type") === "boundary") &&
      selection.get(e.get("id"))
    ));
    const boundaryDots = boundaries.map((b, i) => {
      const arc = b.get("arc") || 0;
      const startPoint = entities.get(b.get("start"));
      const endPoint = entities.get(b.get("end"));
      const start3 = new Vector3().copy(startPoint).setZ(0);
      const end3 = new Vector3().copy(endPoint).setZ(0);
      const center3 = end3.clone().add(start3).multiplyScalar(0.5);
      const delta3 = end3.clone().sub(start3);
      const normal3 = new Vector3(-delta3.y, delta3.x, 0).normalize();
      const centerWithArc3 = normal3.multiplyScalar(arc).add(center3);
      const center2 = viewport._resolveLocation2(center3);
      const centerWithArc2 = viewport._resolveLocation2(centerWithArc3);
      return <Draggable {...{
        key: i,
        position: centerWithArc2,
        onStart: (_, pos) => this._onHandleDragStart(b, center2, pos),
        onDrag: (_, pos) => this._onHandleDrag(pos),
        onStop: (_, pos) => this._onHandleDragStop(pos)
      }}><Dot/></Draggable>;
    }).toJS();
    return <div
      style={{
        display: "block",
        position: "absolute",
        left: 0,
        top: 0,
        zIndex: 15
      }}
      onMouseDown={_preventViewportMousedown}
    >
      {boundaryDots}
    </div>;
  }
}

// Tooltip dots
function Dot (props) {
  const size = props.size || 10;
  return <div {...props}
    style={{
      display: "block",
      position: "absolute",
      marginLeft: -size/2,
      marginTop: -size/2,
      width: size,
      height: size,
      borderRadius: size / 2,
      background: props.color || "#ccc",
      cursor: "pointer",
      ...(props.style || {})
    }}
  >{ props.children }</div>;
}

export default class ArcTool {
  constructor () {
    this.name = TOOL_NAME;
    this.toolButton = (
      <ToolButton additionalClasses={["arc-tool-button"]}>
        <div>adjust</div>
        <div>arcs</div>
      </ToolButton>
    );
    this.enableClickSelect = true;
  }
  getViewportOverlay ({ viewport }) {
    const {
      floor,
      dispatch
    } = viewport.props;
    const {
      lastCameraSync
    } = viewport.state;

    // don't render dots for empty selections
    return <ArcOverlay {...{
      floor,
      viewport,
      lastCameraSync,
      dispatch
    }} />;
  }
}

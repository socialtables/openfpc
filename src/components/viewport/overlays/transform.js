import { Component } from "react";
import { Vector2, Vector3, Matrix4 } from "three";
import Draggable from "react-draggable";
import {
  transformTooltopDragStart,
  transformTooltopDrag,
  transformTooltopDragComplete
} from "../../../actions/ui-actions";
import {
  updatePendingEntities,
  applyPendingUpdate
} from "../../../actions/floor-actions";

import { ScaleArrow, RotateArrow } from "../../icons";
import IconCursor from "./icon-cursor";
import TransformDragPickup from "./transform-drag-pickup";
import TransformBoxOverlay from "./transform-box";

import {
  makeHandlePositionMatrix
} from "../../../lib/transformation-math";

const TRANSFORM_HANDLE_POSITIONS = [
  [ 0.5, 0.5, "scale"],
  [ 0.5, -0.5, "scale"],
  [-0.5, 0.5, "scale"],
  [-0.5, -0.5, "scale"],
  [ 0.5, 0.5, "rotate", 20, 20],
  [ 0.5, -0.5, "rotate", 20, -20],
  [ -0.5, 0.5, "rotate", -20, 20],
  [ -0.5, -0.5, "rotate", -20, -20]
]
.map(p => ({
  type: p[2],
  position: new Vector3(p[0], p[1], 0),
  offset: new Vector3(p[3] || 0, p[4] || 0, 0)
}));

function _preventViewportMousedown(e) {
  e.stopPropagation();
  e.preventDefault();
  return false;
}

export default class TransformOverlay extends Component {
  constructor (props) {
    super(props);
    const { viewport, floor } = props;
    const { selection } = floor;
    const [bbox2, bbox3] = viewport._resolveEntityBoundingBoxes(selection);

    this.handlesHovering = [];
    this.state = {
      dragging: false,
      dragHandleIndex: null,
      dragTransformMatrix: null,
      dragStartAngle: 0,
      initialBBox2: bbox2,
      initialBBox3: bbox3,
      lastCameraSync: viewport.lastCameraSync,
      handleTransformMatrix: makeHandlePositionMatrix(bbox2),
      transformEntities: null,
      showCursor: false,
      showBBox: bbox2,
      cursorX: 0,
      cursorY: 0
    };
  }
  componentWillReceiveProps (nextProps) {
    const { viewport, floor, lastCameraSync } = nextProps;
    if (
      (this.props.lastCameraSync !== lastCameraSync) ||
      (this.props.floor !== floor)
    ) {
      if (!this.state.dragging) {
        const selection = floor.get("selection");
        const [bbox2, bbox3] = viewport._resolveEntityBoundingBoxes(selection);
        this.setState({
          initialBBox2: bbox2,
          initialBBox3: bbox3,
          showBBox: bbox2,
          lastCameraSync: viewport.lastCameraSync,
          handleTransformMatrix: makeHandlePositionMatrix(bbox2)
        });
      }
    }
  }
  _getHandlePosition (handle) {
    const handlePosition = handle.position.clone();
    handlePosition.applyMatrix4(this.state.handleTransformMatrix);
    if (this.state.dragTransformMatrix) {
      handlePosition.applyMatrix4(this.state.dragTransformMatrix);
    }
    handlePosition.add(handle.offset);
    return handlePosition;
  }
  _onHandleDragStart (handle, pos) {
    const { dispatch, floor } = this.props;
    let dragStartAngle = null;
    if (handle.type === "rotate") {
      const { x, y } = pos;
      const bbox2Center = this.state.initialBBox2.getCenter();
      const offsetMtx = new Matrix4().makeTranslation(bbox2Center.x, bbox2Center.y, 0);
      const invOffsetMtx = new Matrix4().getInverse(offsetMtx);
      const positionAsOffset = new Vector3(x, y, 0).applyMatrix4(invOffsetMtx);
      dragStartAngle = new Vector2().copy(positionAsOffset).angle();
    }
    const { selection, entities } = floor;
    let transformEntities = entities.filter(e => selection.get(e.get("id")));
    transformEntities = transformEntities.merge(floor.getLinkedPoints(transformEntities));
    this.setState({
      dragStartAngle,
      dragging: true,
      transformEntities,
      showBBox: false
    });
    dispatch(transformTooltopDragStart());
  }
  _onHandleDrag (handle, pos) {
    const { x, y } = pos;
    const { dispatch } = this.props;
    const {
      handleTransformMatrix,
      initialBBox2,
      initialBBox3,
      transformEntities
    } = this.state;
    const initialBBox3Center = initialBBox3.getCenter();
    const initialBBox3Size = initialBBox3.getSize();
    const sceneTranslateMtx = new Matrix4().makeTranslation(
      initialBBox3Center.x,
      initialBBox3Center.y,
      0
    );
    const invSceneTranslateMtx = new Matrix4().getInverse(sceneTranslateMtx);

    let dragTransformMatrix, sceneTransformMatrix;
    if (handle.type === "scale") {
      const invTransform = new Matrix4().getInverse(handleTransformMatrix);
      const rawOffset = handle.position;
      const oppositeOffset = handle.position.clone().multiplyScalar(-1);
      const positionAsOffset = new Vector3(x, y, 0).applyMatrix4(invTransform);

      const pDiff = positionAsOffset.clone().sub(oppositeOffset);
      const iDiff = rawOffset.clone().sub(oppositeOffset);
      const sDiff = pDiff.clone().divide(iDiff);
      const tDiff = pDiff.clone().sub(iDiff).multiplyScalar(0.5);

      const scaleMtx = new Matrix4().makeScale(sDiff.x, sDiff.y, 1);
      const translateMtx = new Matrix4().makeTranslation(tDiff.x, tDiff.y, 0);
      const sceneRelativeTranslateMtx = new Matrix4().makeTranslation(
        initialBBox3Size.x * tDiff.x,
        initialBBox3Size.y * tDiff.y,
        1
      );

      dragTransformMatrix = invTransform.clone()
      .premultiply(scaleMtx)
      .premultiply(translateMtx)
      .premultiply(handleTransformMatrix);
      sceneTransformMatrix = invSceneTranslateMtx.clone()
      .premultiply(scaleMtx)
      .premultiply(sceneRelativeTranslateMtx)
      .premultiply(sceneTranslateMtx);
    }
    else if (handle.type === "rotate") {
      const bbox2Center = initialBBox2.getCenter();
      const offsetMtx = new Matrix4().makeTranslation(bbox2Center.x, bbox2Center.y, 0);
      const invOffsetMtx = new Matrix4().getInverse(offsetMtx);
      const positionAsOffset = new Vector3(x, y, 0).applyMatrix4(invOffsetMtx);
      const dragAngle = new Vector2().copy(positionAsOffset).angle();
      const deltaTheta = (dragAngle - this.state.dragStartAngle);
      const rotationMtx = new Matrix4().makeRotationZ(deltaTheta);
      dragTransformMatrix = invOffsetMtx.clone()
      .premultiply(rotationMtx)
      .premultiply(offsetMtx);
      sceneTransformMatrix = invSceneTranslateMtx.clone()
      .premultiply(rotationMtx)
      .premultiply(sceneTranslateMtx);
    }
    this.setState({
      dragging: true,
      dragTransformMatrix
    });
    dispatch(transformTooltopDrag());
    if (!transformEntities) {
      console.error("missing transform entities -- something's wrong!"); // eslint-disable-line no-console
      return;
    }
    const floor = this.props.floor;
    let updatedEntities = transformEntities.map(
      e => e.applyMatrix4 ?
        e.applyMatrix4(sceneTransformMatrix) :
        e
    );
    // sync permanent objects
    const updatedFloorEntities = floor.get("entities").merge(updatedEntities);
    const boundariesWithUpdates = floor.getLinkedBoundaries(updatedEntities);
    const objectUpdates = floor.getLinkedObjects(boundariesWithUpdates).map(
      o => o.maintainAttachment(updatedFloorEntities)
    );
    updatedEntities = updatedEntities.merge(objectUpdates);
    dispatch(updatePendingEntities(updatedEntities));
  }
  _onHandleDragStop () {
    const { dispatch } = this.props;
    this.setState({
      dragging: false,
      dragHandleIndex: null,
      dragTransformMatrix: null,
      transformEntities: null
    });
    dispatch(transformTooltopDragComplete());
    dispatch(applyPendingUpdate());
  }
  componentDidMount () {
    const { viewportEvents } = this.props;
    if (viewportEvents) {
      this.onMouseMove = e => this._onMouseMove(e);
      viewportEvents.on("mouseMove", this.onMouseMove);
    }
  }
  componentWillUnmount () {
    const { viewportEvents } = this.props;
    if (viewportEvents && this._onMouseMove) {
      viewportEvents.removeListener("mouseMove", this.onMouseMove);
      this._onMouseMove = null;
    }
  }
  _onMouseMove ({ cursorPosition2D }) {
    const { dragging, initialBBox2 } = this.state;
    let { showCursor } = this.state;
    let cursorX = 0;
    let cursorY = 0;
    let cursorRotation = 0;
    showCursor = dragging ? showCursor : this.handlesHovering.find(v => v);
    if (cursorPosition2D) {
      cursorX = cursorPosition2D.x;
      cursorY = cursorPosition2D.y;
    }
    if (showCursor === "scale") {
      if (initialBBox2) {
        const center = initialBBox2.getCenter();
        cursorRotation = center.clone().sub(new Vector2(cursorX, cursorY)).angle();
        if (isNaN(cursorRotation)) {
          cursorRotation = 0;
        }
        else {
          cursorRotation *= 180 / Math.PI;
          cursorRotation -= ((cursorRotation + (45 / 2)) % 45) - 45 / 2;
        }
      }
    }
    this.setState({
      cursorRotation,
      showCursor,
      cursorX,
      cursorY
    });
    if (this.props.setCursor) {
      this.props.setCursor(showCursor ? "none" : null);
    }
  }
  render () {
    const {
      cursorX,
      cursorY,
      showCursor,
      cursorRotation = 0,
      showBBox
    } = this.state;
    const overlayStyle = {
      display: "block",
      position: "relative",
      left: 0,
      top: 0,
      zIndex: 15
    };
    return <div style={overlayStyle}>
      { showBBox && <TransformBoxOverlay bbox={showBBox}/> }
      <div
        onMouseDown={_preventViewportMousedown}>
        { showCursor && <IconCursor {...{
          Icon: (showCursor === "rotate") ? RotateArrow : ScaleArrow,
          iconRotation: cursorRotation,
          x: cursorX,
          y: cursorY
        }}/> }
        { TRANSFORM_HANDLE_POSITIONS.map((handle, i) => (
          <Draggable {...{
            key: i,
            position: this._getHandlePosition(handle),
            onStart: (_, pos) => this._onHandleDragStart(handle, pos),
            onDrag: (_, pos) => this._onHandleDrag(handle, pos),
            onStop: (_, pos) => this._onHandleDragStop(handle, pos)
          }}>
            <TransformDragPickup {...{
              onMouseEnter: () => this.handlesHovering[i] = handle.type,
              onMouseMove: () => this.handlesHovering[i] = handle.type,
              onMouseLeave: () => this.handlesHovering[i] = false
            }}/>
          </Draggable>
        )) }
      </div>
    </div>;
  }
}

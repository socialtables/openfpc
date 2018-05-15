import { Component } from "react";
import { connect } from "react-redux";
import { Map, Set } from "immutable";
import { Point, Boundary, PermanentObject } from "../model";
import {
  ADD_BOUNDARY_TOOL_NAME,
  ADD_OBJECT_TOOL_NAME
} from "../constants/tools";
import {
  updatePendingEntities,
  applyPendingUpdate
} from "../actions/floor-actions";
import GuideSnapper from "../lib/guide-snapping";

export class AddBoundaryTool {
  constructor () {
    this.name = ADD_BOUNDARY_TOOL_NAME;
  }
  getViewportOverlay(props) {
    return <AddBoundaryViewport {...props}/>;
  }
}

export class AddObjectTool {
  constructor () {
    this.name = ADD_OBJECT_TOOL_NAME;
    this.disableEntityHover = true;
  }
  getViewportOverlay(props) {
    return <AddObjectViewport {...props}/>;
  }
}

function _constructEntityMap(entities) {
  const entMap = {};
  entities.forEach(entity => {
    if (entity) {
      entMap[entity.get("id")] = entity;
    }
  });
  return new Map(entMap);
}


class AddBoundaryViewportRaw extends Component {
  constructor (props) {
    super(props);
    this.guideSnapper = new GuideSnapper();
    this.state = {
      dragging: false,
      dragStartLocation: null,
      pendingStartPoint: null,
      pendingEndPoint: null,
      pendingEndSnap: null,
      pendingBoundary: null,
      shiftDown: false
    };
  }
  render () {
    return null;
  }
  componentDidMount() {
    const { viewportEvents } = this.props;
    this._onMouseDown = this.onViewportMouseDown.bind(this);
    this._onMouseUp = this.onViewportMouseUp.bind(this);
    this._onMouseDrag = this.onViewportMouseDrag.bind(this);
    this._onKeyUp = this.onKeyUp.bind(this);
    this._onKeyDown = this.onKeyDown.bind(this);
    viewportEvents.on("mouseDown", this._onMouseDown);
    viewportEvents.on("mouseUp", this._onMouseUp);
    viewportEvents.on("mouseDrag", this._onMouseDrag);
    document.addEventListener("keydown", this._onKeyDown);
    document.addEventListener("keyup", this._onKeyUp);
  }
  componentWillUnmount () {
    const { dispatch, viewportEvents } = this.props;
    viewportEvents.removeListener("mouseDown", this._onMouseDown);
    viewportEvents.removeListener("mouseUp", this._onMouseUp);
    viewportEvents.removeListener("mouseDrag", this._onMouseDrag);
    document.removeEventListener("keydown", this._onKeyDown);
    document.removeEventListener("keyup", this._onKeyUp);
    if (this.state.dragging) {
      dispatch(updatePendingEntities(null));
    }
  }
  onViewportMouseDown({ getTargetEntity, cursorPosition3D, viewport }) {
    let dragStartLocation;
    let pendingStartPoint = null;

    const dragStartEntity = getTargetEntity();
    if (dragStartEntity && dragStartEntity.get("type") === "point") {
      pendingStartPoint = dragStartEntity;
      dragStartLocation = dragStartEntity.toVector3();
    }
    else {
      const { floor, enableSnapGuides } = viewport.props;
      pendingStartPoint = new Point({
        x: cursorPosition3D.x,
        y: cursorPosition3D.y
      });
      dragStartLocation = cursorPosition3D;
      // snap start of new boundaries
      if (enableSnapGuides) {
        const snapRes = this.guideSnapper.getBestSnap(floor, cursorPosition3D);
        const snapPosition = snapRes[2];
        if (snapPosition) {
          pendingStartPoint = pendingStartPoint.merge({
            x: snapPosition.x,
            y: snapPosition.y
          });
        }
      }
    }
    this.setState({
      dragging: false,
      dragStartLocation,
      pendingStartPoint,
      pendingEndPoint: null,
      pendingEndSnap: null
    });
  }
  onViewportMouseDrag({ viewport, cursorPosition3D }) {
    const {
      dispatch,
      boundaryType
    } = this.props;
    let {
      dragging,
      pendingStartPoint,
      pendingEndPoint,
      pendingBoundary,
      pendingEndSnap,
      shiftDown,
      dragStartLocation
    } = this.state;

    let pos3 = cursorPosition3D;
    if (shiftDown) {
      const dragDelta = pos3.clone().sub(dragStartLocation);
      if (Math.abs(dragDelta.x) > Math.abs(dragDelta.y)) {
        pos3 = pos3.clone().setY(dragStartLocation.y);
      }
      else {
        pos3 = pos3.clone().setX(dragStartLocation.x);
      }
    }

    if (!dragging) {
      pendingEndPoint = new Point({
        x: pos3.x,
        y: pos3.y
      });
      pendingBoundary = new Boundary({
        start: pendingStartPoint.get("id"),
        end: pendingEndPoint.get("id"),
        type: boundaryType || "wall"
      });
    }
    else {
      pendingEndPoint = pendingEndPoint.merge({
        x: pos3.x,
        y: pos3.y
      });
    }

    let snapGuides = null;
    const [snapEntity, snapPosition] = viewport._resolveEntitySnap({
      position: pos3,
      snapBoundaries: true,
      snapPoints: true,
      pointBias: 2
    });

    if (snapEntity) {
      pendingEndSnap = snapEntity;
      pendingEndPoint = pendingEndPoint.merge({
        x: snapPosition.x,
        y: snapPosition.y
      });
    }
    else {
      pendingEndSnap = null;

      // fall back to guide-based snapping
      const { floor, enableSnapGuides } = viewport.props;
      if (enableSnapGuides) {
        const snapRes = this.guideSnapper.getBestSnap(floor, pos3);
        const snapPosition = snapRes[2];
        if (snapPosition) {
          snapGuides = snapRes[0];
          pendingEndPoint = pendingEndPoint.merge({
            x: snapPosition.x,
            y: snapPosition.y
          });
        }
      }
    }

    this.setState ({
      dragging: true,
      pendingEndPoint,
      pendingEndSnap,
      pendingBoundary
    });
    dispatch(updatePendingEntities(
      _constructEntityMap([
        pendingStartPoint,
        pendingEndPoint,
        pendingBoundary
      ]),
      {
        snapGuides
      }
    ));
  }
  onViewportMouseUp() {
    const {
      dispatch,
      floor,
      floorEntities
    } = this.props;
    const {
      dragging,
      pendingStartPoint,
      pendingEndPoint,
      pendingEndSnap
    } = this.state;
    let {
      pendingBoundary
    } = this.state;

    // if dragging and snapping, try to snap boundary
    if (dragging && pendingEndSnap && (pendingEndSnap.get("type") === "point")) {
      pendingBoundary = pendingBoundary.reassignEndpoints(null, pendingEndSnap.get("id"));
      if (floorEntities.get(pendingStartPoint.get("id"))) {
        const pStart = pendingBoundary.get("start");
        const pEnd = pendingBoundary.get("end");
        const extantFlatBoundary = floorEntities
        .valueSeq()
        .filter(e => {
          if (e.get("type") === "boundary") {
            const eStart = e.get("start");
            const eEnd = e.get("end");
            if (
              ((eStart === pStart) && (eEnd === pEnd)) ||
                ((eStart === pEnd) && (eEnd === pStart))
            ) {
              return !e.get("arc");
            }
          }
          return false;
        }).first();
        if (!extantFlatBoundary) {
          dispatch(applyPendingUpdate(_constructEntityMap([
            pendingBoundary
          ])));
        }
        else {
          dispatch(updatePendingEntities(null));
        }
      }
      else {
        dispatch(applyPendingUpdate(_constructEntityMap([
          pendingStartPoint,
          pendingBoundary
        ])));
      }
    }
    else if (dragging && pendingEndSnap && (pendingEndSnap.get("type") === "boundary")) {
      const splitBoundUpdates = floor.getSplitBoundaryUpdates(
        pendingEndSnap,
        pendingEndPoint
      );
      const removeIDs = new Set([pendingEndSnap.get("id")]);
      dispatch(applyPendingUpdate(
        splitBoundUpdates.merge(_constructEntityMap([
          pendingStartPoint,
          pendingEndPoint,
          pendingBoundary
        ])),
        removeIDs
      ));
    }
    // if otherwise dragging, no need to snap
    else if (dragging) {
      dispatch(applyPendingUpdate(_constructEntityMap([
        pendingStartPoint,
        pendingEndPoint,
        pendingBoundary
      ])));
    }
    // if not, make point
    else if (pendingStartPoint && !floorEntities.get(pendingStartPoint.get("id"))) {
      dispatch(applyPendingUpdate(_constructEntityMap([
        pendingStartPoint
      ])));
    }
    this.setState({
      dragging: false,
      pendingStartPoint: null,
      pendingEndPoint: null,
      pendingEndSnap: null,
      pendingBoundary: null
    });
  }
  onKeyDown (event) {
    switch ((event.key||"").toLowerCase()) {
    case "shift":
      this.setState({ shiftDown: true });
      break;
    default:
      break;
    }
  }
  onKeyUp (event) {
    switch ((event.key||"").toLowerCase()) {
    case "shift":
      this.setState({ shiftDown: false });
      break;
    default:
      break;
    }
  }
}

class AddObjectViewportRaw extends Component {
  constructor (props) {
    super(props);
    this.guideSnapper = new GuideSnapper();
    this.state = {
      pendingEntity: null
    };
  }
  render () {
    return null;
  }
  componentDidMount() {
    const { viewportEvents } = this.props;
    this._onMouseUp = this.onViewportMouseUp.bind(this);
    viewportEvents.on("mouseUp", this._onMouseUp);
  }
  componentWillUnmount () {
    const { dispatch, viewportEvents } = this.props;
    viewportEvents.removeListener("mouseUp", this._onMouseUp);
    dispatch(updatePendingEntities(null));
  }
  componentWillReceiveProps (nextProps) {
    const { dispatch, objectType = "door", viewport, floorEntities } = this.props;
    if (nextProps.cursorPosition3D !== this.props.cursorPosition3D) {
      if (nextProps.cursorPosition3D && floorEntities) {
        let obj = this._getPendingEntity().merge(Object.assign(
          {},
          {
            objectType,
            x: nextProps.cursorPosition3D.x,
            y: nextProps.cursorPosition3D.y
          },
          this._getDefaultObjectDimensions(objectType)
        ));
        const { enableSnapGuides, floor } = viewport.props;
        const [snapBoundary] = viewport._resolveEntitySnap({
          position: nextProps.cursorPosition3D,
          snapPoints: false,
          snapBoundaries: true
        });
        let snapGuides;
        if (snapBoundary) {
          obj = obj.attachToBoundary(snapBoundary, floorEntities);
        }
        else if (enableSnapGuides) {
          const snapRes = this.guideSnapper.getBestSnap(floor, nextProps.cursorPosition3D);
          const snapPos = snapRes[2];
          if (snapPos) {
            snapGuides = snapRes[0];
            obj = obj.merge({
              x: snapPos.x,
              y: snapPos.y
            });
          }
        }
        dispatch(updatePendingEntities(
          _constructEntityMap([obj]),
          { snapGuides }
        ));
      }
      else {
        dispatch(updatePendingEntities(null));
      }
    }
  }
  _getDefaultObjectDimensions (objectType) {
    switch (objectType) {
    case "window":
      return {
        width: 36,
        height: 36
      };
    case "round-column":
      return {
        width: 48,
        height: 48
      };
    case "rigging":
      return {
        width: 12,
        height: 12
      };
    case "electric-outlet":
      return {
        width: 12,
        height: 12
      };
    case "double-door":
      return {
        width: 36,
        height: 80
      };
    case "door":
      return {
        width: 36,
        height: 80
      };
    case "column":
      return {
        width: 48,
        height: 48
      };
    default:
      return {
        width: 24,
        height: 24
      };
    }
  }
  _getPendingEntity () {
    if (!this.state.pendingEntity) {
      return this.state.pendingEntity = new PermanentObject();
    }
    return this.state.pendingEntity;
  }
  _nextPendingEntity () {
    this.state.pendingEntity = null;
  }
  onViewportMouseUp() {
    const{ dispatch } = this.props;
    dispatch(applyPendingUpdate());
    this._nextPendingEntity();
  }
}

const AddBoundaryViewport = connect(
  function mapStateToProps({ editor, floor }) {
    return {
      boundaryType: editor.get("newBoundaryType"),
      floor: floor && floor.present,
      floorEntities: floor && floor.present.get("entities")
    };
  }
)(AddBoundaryViewportRaw);

const AddObjectViewport = connect(
  function mapStateToProps({ editor, floor }) {
    return {
      objectType: editor.get("newObjectType"),
      floorEntities: floor && floor.present.get("entities")
    };
  }
)(AddObjectViewportRaw);

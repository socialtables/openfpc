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
      pendingStartSnap: null,
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
    let pendingStartSnap = null;

    const dragStartEntity = getTargetEntity();
    if (dragStartEntity && dragStartEntity.get("type") === "point") {
      pendingStartPoint = dragStartEntity;
      dragStartLocation = dragStartEntity.toVector3();
    }
    else {
      dragStartLocation = cursorPosition3D;
      pendingStartPoint = new Point({
        x: cursorPosition3D.x,
        y: cursorPosition3D.y
      });

      // snap start of new boundaries
      const [snapPosition, snapEntity] = this._resolveHybridSnap(viewport, cursorPosition3D);
      if (snapPosition) {
        pendingStartPoint = pendingStartPoint.merge({
          x: snapPosition.x,
          y: snapPosition.y
        });
        pendingStartSnap = snapEntity;
      }
    }

    this.setState({
      dragging: false,
      dragStartLocation,
      pendingStartPoint,
      pendingStartSnap,
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
      pendingStartSnap,
      pendingEndPoint,
      pendingBoundary,
      pendingEndSnap,
      shiftDown
    } = this.state;

    const pos3 = cursorPosition3D;
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

    const constrainToPoint = shiftDown ? pendingStartPoint : null;
    const [snapPosition, snapEntity, snapGuides] = this._resolveHybridSnap(viewport, cursorPosition3D, constrainToPoint, pendingStartSnap);
    if (snapPosition) {
      pendingEndPoint = pendingEndPoint.merge({
        x: snapPosition.x,
        y: snapPosition.y
      });
    }
    pendingEndSnap = snapEntity;

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
      floorEntities,
      boundaryType
    } = this.props;
    const {
      dragging,
      pendingStartPoint,
      pendingStartSnap,
      pendingEndPoint,
      pendingEndSnap
    } = this.state;
    let {
      pendingBoundary
    } = this.state;

    // build working entity map
    let workingEntities = floorEntities.set(pendingStartPoint.get("id"), pendingStartPoint);
    if (pendingEndPoint) {
      workingEntities = workingEntities.set(pendingEndPoint.get("id"), pendingEndPoint);
    }
    if (pendingBoundary) {
      workingEntities = workingEntities.set(pendingBoundary.get("id"), pendingBoundary);
    }

    // get click-only logic out of the way first
    if (!dragging) {
      // segment bisection
      if (pendingStartSnap && pendingStartSnap.get("type") === "boundary") {
        const [boundA, boundB] = pendingStartSnap.splitAtPoint(workingEntities, pendingStartPoint);
        dispatch(applyPendingUpdate(
          _constructEntityMap([pendingStartPoint, boundA, boundB]),
          new Set([pendingStartSnap.get("id")])
        ));
      }
      // free-floating points in space
      else if (pendingStartPoint && !floorEntities.get(pendingStartPoint.get("id"))) {
        dispatch(applyPendingUpdate(_constructEntityMap([
          pendingStartPoint
        ])));
      }
      this._clearDragState();
      return;
    }

    // boundary-over-boundary sub-section case
    if (
      pendingStartSnap &&
      pendingEndSnap &&
      pendingStartSnap.get("type") === "boundary" &&
      pendingStartSnap === pendingEndSnap
    ) {
      // slice the target boundary into three subsections
      const [splitBoundA, splitBoundB] = pendingStartSnap.splitAtPoint(workingEntities, pendingStartPoint);
      const [splitAA, splitAB, biasA] = splitBoundA.splitAtPoint(workingEntities, pendingEndPoint);
      let newBoundaries;
      if (biasA > 1 || biasA < 0) {
        const [splitBA, splitBB] = splitBoundB.splitAtPoint(workingEntities, pendingEndPoint);
        newBoundaries = [splitBoundA, splitBA, splitBB];
      }
      else {
        newBoundaries = [splitBoundB, splitAA, splitAB];
      }
      // adjust the type of the center boundary
      const startPoint2 = pendingStartPoint.toVector2();
      const endPoint2 = pendingEndPoint.toVector2();
      const midPoint = startPoint2.add(endPoint2).multiplyScalar(0.5);
      // handle arcs by bridging them with new boundaries
      if (pendingStartSnap.get("arc")) {
        newBoundaries.push(pendingBoundary);
      }
      // otherwise alter the type of the boundary in the center after split
      else {
        newBoundaries = newBoundaries.map(b => {
          const alignmentInfo = b.getAlignmentInfo(workingEntities, midPoint);
          const bias = alignmentInfo[2];
          if (bias >= 0 && bias <=1) {
            return b.set("boundaryType", boundaryType);
          }
          return b;
        });
      }
      // add new boundaries, remove the old
      dispatch(applyPendingUpdate(
        _constructEntityMap([
          pendingStartPoint,
          pendingEndPoint,
          ...newBoundaries
        ]),
        new Set([pendingStartSnap.get("id")])
      ));
      this._clearDragState();
      return;
    }

    const pointsToCreate = [];

    // handle start point, end point
    if (!floorEntities.get(pendingStartPoint.get("id"))) {
      pointsToCreate.push(pendingStartPoint);
    }

    if (pendingEndSnap && pendingEndSnap.get("type") === "point") {
      pendingBoundary = pendingBoundary.reassignEndpoints(null, pendingEndSnap.get("id"));
      // check for cases where a user has drawn one boundary over another
      const pStart = pendingBoundary.get("start");
      const pEnd = pendingBoundary.get("end");
      const extantFlatBoundary = floorEntities.valueSeq().filter(e => {
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
      if (extantFlatBoundary) {
        dispatch(applyPendingUpdate(new Map()));
        this._clearDragState();
        return;
      }
    }
    else {
      pointsToCreate.push(pendingEndPoint);
    }

    // handle bisection cases
    let splitBoundUpdates = new Map();
    let boundIdsToRemove = new Set();
    if (pendingStartSnap && pendingStartSnap.get("type") === "boundary") {
      splitBoundUpdates = splitBoundUpdates.merge(floor.getSplitBoundaryUpdates(
        pendingStartSnap,
        pendingStartPoint
      ));
      boundIdsToRemove = boundIdsToRemove.add(pendingStartSnap.get("id"));
    }

    if (pendingEndSnap && pendingEndSnap.get("type") === "boundary") {
      splitBoundUpdates = splitBoundUpdates.merge(floor.getSplitBoundaryUpdates(
        pendingEndSnap,
        pendingEndPoint
      ));
      boundIdsToRemove = boundIdsToRemove.add(pendingEndSnap.get("id"));
    }

    dispatch(applyPendingUpdate(
      splitBoundUpdates.merge(_constructEntityMap(pointsToCreate.concat(pendingBoundary))),
      boundIdsToRemove
    ));

    this._clearDragState();
  }
  // helper to reset drag state to simplify the above method
  _clearDragState () {
    this.setState({
      dragging: false,
      pendingStartPoint: null,
      pendingStartSnap: null,
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
  _resolveHybridSnap (viewport, position, constrainToPoint = null, fromBoundary = null) {
    const { floor, enableSnapGuides } = viewport.props;
    let snapGuides = null;
    let [snapEntity, snapPosition] = viewport._resolveEntitySnap({
      position: position,
      snapBoundaries: true,
      snapPoints: true,
      pointBias: 2
    });

    // if we're holding shift and want immediate point guides, do that
    if (constrainToPoint) {
      let guideSnapEntity = null;
      if (snapEntity && snapEntity.get("type") === "boundary") {
        guideSnapEntity = snapEntity;
      }
      const guideSnapRes = this.guideSnapper.getPointConstrainedSnap(floor, constrainToPoint, fromBoundary, position, guideSnapEntity);
      const guideSnapPosition = guideSnapRes[2];
      if (guideSnapPosition) {
        snapGuides = guideSnapRes[0];
        snapPosition = guideSnapPosition;
      }
    }

    // if we have snap guides + a snap boundary, combine them
    if (enableSnapGuides) {
      let guideSnapEntity = null;
      if (snapEntity && snapEntity.get("type") === "boundary") {
        guideSnapEntity = snapEntity;
      }
      const guideSnapRes = this.guideSnapper.getBestSnap(floor, position, 20, guideSnapEntity);
      const guideSnapPosition = guideSnapRes[2];
      if (guideSnapPosition) {
        snapGuides = guideSnapRes[0];
        snapPosition = guideSnapPosition;
      }
    }
    return [snapPosition, snapEntity, snapGuides];
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

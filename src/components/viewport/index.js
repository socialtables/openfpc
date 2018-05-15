const debug = require("debug")("openfpc:components:viewport:editor");
import EventEitter from "events";
import {
  Box2,
  Box3,
  Vector3,
  Vector2,
  OrthographicCamera,
  Plane,
  Raycaster,
  WebGLRenderer
} from "three";
import { Map, Set } from "immutable";
import { Component } from "react";
import { connect } from "react-redux";
import {
  selectEntities,
  deselectEntities,
  deleteEntities,
  updatePendingEntities,
  applyPendingUpdate
} from "../../actions/floor-actions";
import CRMaintainer from "../../lib/collision-resolver-maintainer";
import SceneMaintainer from "../../lib/renderable-scene-maintainer";
import GuideSnapper from "../../lib/guide-snapping";
import SelectBoxOverlay from "./overlays/select-box";
import TransformOverlay from "./overlays/transform";
import CursorHintOverlay from "./overlays/cursor-hint";
const UP = new Vector3(0, 0, 1);

class Viewport extends Component {
  constructor (props) {
    super(props);
    const { colorScheme, sceneFrame } = props;

    this.crMaintainer = new CRMaintainer();
    this.sceneMaintainer = new SceneMaintainer({
      colorScheme,
      onAsyncLoadFinished: () => this._requestRender()
    });
    this.sceneMaintainer.labelsEnabled = true;
    this.mouseEventEmitter = new EventEitter();
    this.guideSnapper = new GuideSnapper();

    // maintain internal UI state for things like hover calculations that
    // do not effect the larger application, internal drag implementation
    this.state = {
      // camera
      zoomFactor: 10,
      cameraPosition: sceneFrame ?
        new Vector3(sceneFrame[0] / 2, sceneFrame[1] / 2, 1) :
        new Vector3(0, 0, 1),
      lastCameraSync: null,
      // container
      containerSize: new Vector2(),
      // cursor tracking
      hoveringOnContainer: false,
      hoveringOnEntity: null,
      isMousedown: false,
      cursorPosition2D: null,
      cursorPosition3D: null,
      mouseDownSelection: null,
      dragging: false,
      dragStart2D: null,
      dragStart3D: null,
      selectionBBox2: null,
      shiftDown: false,
      snappedToEntity: null
    };

    // store refs to event listers here to ensure we can remove them later
    this.listeners = {};
  }
  componentDidMount() {
    const { pixelRatio = window.devicePixelRatio || 1 } = this.props;
    const { zoomFactor = 1 } = this.state;

    // grab canvas width/height, and install a window resize listener if
    // under-specced (e.g. we can't fully determine size from props)
    const { width, height } = this._resolveCanvasSize();
    // only mutate this in-place here; afterwards, reassign!
    this.state.containerSize.x = width;
    this.state.containerSize.y = height;
    if (width !== this.props.width || height !== this.props.height) {
      this._resizeListener = () => this._handleResize();
      window.addEventListener("resize", this._resizeListener);
    }

    // add listener for scrolling to control zoom
    this._mousewheelListener = e => this._handleMousewheel(e);
    window.addEventListener("mousewheel", this._mousewheelListener);

    // capture shift for add tool
    this._keyDownListener = e => this.onKeyDown(e);
    window.addEventListener("keydown", this._keyDownListener);
    this._keyUpListener = e => this.onKeyUp(e);
    window.addEventListener("keyup", this._keyUpListener);

    // TODO: not reference these directly
    this.scene = this.sceneMaintainer.scene;
    this.sceneEntityMap = this.sceneMaintainer.sceneEntityMap;
    this.hr = this.crMaintainer.getResolver();
    "";
    this.camera = new OrthographicCamera(
      width * -0.5 * zoomFactor,
      width * 0.5 * zoomFactor,
      height * -0.5 * zoomFactor,
      height * 0.5 * zoomFactor,
      -100,
      100
    );

    this.camera.lookAt(new Vector3().sub(UP));
    this.camera.position.copy(this.state.cameraPosition);

    this.renderer = new WebGLRenderer({ canvas: this.canvas });
    this.renderer.setClearColor(this.sceneMaintainer.clearColor);
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.setSize(width, height);

    this._syncScene(this.props.floor, this.props.colorScheme);

    if (this.props.floor.get("entities").count()) {
      this._zoomToFitScene();
    }

    this._requestRender();
  }
  componentWillUnmount() {
    if (this._resizeListener) {
      window.removeEventListener("resize", this._resizeListener);
    }
    if (this._mousewheelListener) {
      window.removeEventListener("mousewheel", this._mousewheelListener);
    }
    if (this._keyDownListener) {
      window.removeEventListener("keydown", this._keyDownListener);
    }
    if (this._keyUpListener) {
      window.removeEventListener("keyup", this._keyUpListener);
    }
  }
  componentWillReceiveProps(nextProps) {
    if (
      (nextProps.floor !== this.props.floor) ||
      (nextProps.colorScheme !== this.props.colorScheme) ||
      (nextProps.selectableEntityTypes !== this.props.selectableEntityTypes) ||
      (nextProps.hiddenEntityTypes !== this.props.hiddenEntityTypes) ||
      (nextProps.hiddenBoundaryTypes !== this.props.hiddenBoundaryTypes)
    ) {
      this._syncScene(
        nextProps.floor,
        (nextProps.colorScheme !== this.props.colorScheme) ? nextProps.colorScheme : null,
        nextProps
      );
      this._requestRender();
    }
    if (nextProps.snapGuides !== this.props.snapGuides) {
      this.sceneMaintainer._setSnapGuides(nextProps.snapGuides);
      this._requestRender();
    }
    if (nextProps.sceneFrame !== this.props.sceneFrame) {
      if (Array.isArray(nextProps.sceneFrame)) {
        this._zoomToBBox(new Box2(nextProps.sceneFrame[0], nextProps.sceneFrame[1]));
      }
      else {
        this._zoomToFitScene();
      }
    }
  }
  _syncScene(floor, colorScheme, nextProps) {
    const { dispatch, hiddenEntityTypes, hiddenBoundaryTypes } = nextProps || this.props;
    if (colorScheme) {
      this.sceneMaintainer.syncColorScheme(colorScheme);
      this.renderer.setClearColor(this.sceneMaintainer.clearColor);
    }
    this.sceneMaintainer.syncFloorState(floor, hiddenEntityTypes, hiddenBoundaryTypes, dispatch);
    this.crMaintainer.syncFloorState(floor);

    // ensure local scene and hover-resolvers still point to correct instances
    this.scene = this.sceneMaintainer.getScene();
    this.hr = this.crMaintainer.getResolver();
    return;
  }
  componentDidUpdate (prevProps, prevState) {
    if (
      (this.state.hoveringOnEntity !== prevState.hoveringOnEntity)
    ) {
      this._syncScene(this.props.floor);
    }
    if (
      (this.props.width !== prevProps.width) ||
      (this.props.height !== prevProps.height) ||
      (this.state.zoomFactor !== prevState.zoomFactor) ||
      (this.state.cameraPosition !== prevState.cameraPosition)
    ) {
      this._handleResize();
    }
  }
  _zoomToFitScene () {
    const bbox = new Box3().setFromObject(this.scene);
    if (!bbox.isEmpty()) {
      this._zoomToBBox(bbox);
    }
  }
  _zoomToBBox (bbox) {
    const bboxSize = bbox.getSize();
    const { width, height } = this._resolveCanvasSize();
    const zoomFactor = Math.max(
      bboxSize.x / width,
      bboxSize.y / height
    );
    const cameraPosition = bbox.getCenter().clone().add(UP);
    if (!(cameraPosition.z > 2)) {
      cameraPosition.z = 2;
    }
    this.camera.position.copy(cameraPosition);
    this.camera.left = width * -0.5 * zoomFactor;
    this.camera.right = width * 0.5 * zoomFactor;
    this.camera.top = height * -0.5 * zoomFactor;
    this.camera.bottom = height * 0.5 * zoomFactor;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);

    // rescale points and lines to work well at varying zooms
    const pointRadiusPx = Math.min(40, 10 / zoomFactor);
    this.sceneMaintainer.pointRadius = pointRadiusPx;
    this.sceneMaintainer.lineThickness = zoomFactor;
    this.crMaintainer.pointRadius = pointRadiusPx * zoomFactor * 0.5;
    this.crMaintainer.lineRadius = pointRadiusPx * zoomFactor * 0.25;

    this.setState({
      cameraPosition,
      zoomFactor,
      containerSize: new Vector2(width, height),
      lastCameraSync: new Date()
    });
    this._requestRender();
  }
  _handleResize () {
    const { zoomFactor = 1, cameraPosition = UP.clone() } = this.state;
    const { width, height } = this._resolveCanvasSize();
    this.camera.position.copy(cameraPosition);
    this.camera.left = width * -0.5 * zoomFactor;
    this.camera.right = width * 0.5 * zoomFactor;
    this.camera.top = height * -0.5 * zoomFactor;
    this.camera.bottom = height * 0.5 * zoomFactor;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);

    // rescale points and lines to work well at varying zooms
    const pointRadiusPx = Math.min(40, 10 / zoomFactor);
    this.sceneMaintainer.pointRadius = pointRadiusPx;
    this.sceneMaintainer.lineThickness = zoomFactor;
    this.crMaintainer.pointRadius = pointRadiusPx * zoomFactor * 0.5;
    this.crMaintainer.lineRadius = pointRadiusPx * zoomFactor * 0.25;

    this.setState({
      containerSize: new Vector2(width, height),
      lastCameraSync: new Date()
    });
    this._requestRender();
  }
  _handleMousewheel (event) {
    if (!this.state.hoveringOnContainer) {
      return;
    }
    const deltaY = event.wheelDeltaY;
    if (deltaY) {
      let { zoomFactor = 1 } = this.state;
      zoomFactor += deltaY * 0.001 * (zoomFactor + 1);
      zoomFactor = Math.max(0.05, zoomFactor);
      zoomFactor = Math.min(10, zoomFactor);
      this.setState({ zoomFactor });
    }
  }
  _resolveCanvasSize () {
    let { width, height } = this.props;
    if (!width || (typeof width !== "number")) {
      width = this.container.clientWidth;
    }
    if (!height || (typeof height !== "number")) {
      height = this.container.clientHeight;
    }
    return { width, height };
  }
  _resolveEntityAtPosition3 (pos3, entityTypes = null) {
    const { selectableEntityTypes } = this.props;
    const { entities } = this.props.floor;
    let disqualify = null;
    if (entityTypes || selectableEntityTypes) {
      const types = entityTypes || selectableEntityTypes;
      disqualify = id => !types[entities.getIn([id, "type"], "_")];
    }
    const selectionID = this.hr.resolveSelection(pos3, disqualify);
    if (selectionID) {
      return entities.get(selectionID) || null;
    }
    return null;
  }
  _resolveEntitiesInBoundingBox (bbox) {
    const { selectableEntityTypes, floor } = this.props;
    const rawSelectionIDs = this.hr.resolveSelectionBox(bbox);
    if (selectableEntityTypes) {
      return rawSelectionIDs.filter(id =>
        selectableEntityTypes[floor.getIn(["entities", id, "type"], "_")]
      );
    }

    rawSelectionIDs.filter(id => floor.getIn("entities", id));

  }
  _handleMouseDown (event) {
    const { floor } = this.props;
    const [pos2, pos3] = this._resolveCursorEventPosition(event);
    const onEntity = this._resolveEntityAtPosition3(pos3);

    // inform current tool of mouseDown
    this._emitToTool("mouseDown", {
      getTargetEntity: () => onEntity,
      cursorPosition2D: pos2,
      cursorPosition3D: pos3
    });

    // FIXME set up for potential selection or drag
    this.dragCamera = this.camera.clone();

    // update state to reflect start of drag
    this.setState({
      hoveringOnEntity: onEntity,
      mouseDownEntity: onEntity,
      mouseDownSelection: floor.get("selection"),
      isMousedown: true,
      dragging: false,
      draggingEntities: null,
      dragStart2D: pos2,
      dragStart3D: pos3,
      cursorPosition2D: pos2,
      cursorPosition3D: pos3
    });
    this._requestRender();
  }
  _handleMouseUp (event) {
    const { dispatch, boxSelect, clickSelect, floor } = this.props;
    const { dragging, draggingEntities, isMousedown } = this.state;
    const [pos2, pos3] = this._resolveCursorEventPosition(event);

    // don't react to drag-releases onto the canvas from another area
    if (isMousedown) {
      this._emitToTool("mouseUp", {
        cursorPosition2D: pos2,
        cursorPosition3D: pos3,
        getTargetEntity: () => this._resolveEntityAtPosition3(pos3)
      });

      if (draggingEntities) {
        // merge points that are dragged into each other
        const { snappedToEntity } = this.state;
        let finalUpdate = null;
        let finalRemoveIDs = null;
        if (
          snappedToEntity &&
          (draggingEntities.count() === 1) &&
          (draggingEntities.valueSeq().first().get("type") === "point")
        ) {
          const toMerge = new Map({[snappedToEntity.get("id")]: snappedToEntity})
          .merge(draggingEntities);
          [finalUpdate, finalRemoveIDs] = floor.getMergedPointUpdates(toMerge);
        }
        dispatch(applyPendingUpdate(finalUpdate, finalRemoveIDs));
      }
      else if (boxSelect || (clickSelect && !dragging)) {
        const selectMore = this.state.shiftDown;

        // drag box selection
        if (dragging && boxSelect) {

          // resolve selection
          debug("resolving box selection");
          const start3D = this.state.dragStart3D;
          const selectionRaw = this._resolveEntitiesInBoundingBox(
            new Box2()
            .expandByPoint(start3D)
            .expandByPoint(pos3)
          );
          let selection = Set(selectionRaw);
          if (selectMore && floor.get("selection")) {
            selection = selection.merge(floor.get("selection"));
          }

          // dispatch selection update
          dispatch(selectEntities(selection));
        }
        // single entity selection
        else if (clickSelect) {
          const releasedOnEntity = this._resolveEntityAtPosition3(pos3);
          let selection = (selectMore ? floor.get("selection") : 0) || new Set();
          if (releasedOnEntity) {
            selection = selection.get(releasedOnEntity.get("id")) ?
              selection.remove(releasedOnEntity.get("id")) :
              selection.add(releasedOnEntity.get("id"));
          }
          dispatch(selectEntities(selection, pos2));
        }
      }
    }
    this.dragCamera = null;
    this.setState({
      isMousedown: false,
      dragging: false,
      dragStart2D: null,
      dragStart3D: null,
      cursorPosition2D: pos2,
      cursorPosition3D: pos3,
      selectionBBox2: null,
      snappedToEntity: null
    });
  }
  _handleMouseMove (event) {
    const [pos2, pos3] = this._resolveCursorEventPosition(event);
    const {
      cameraDrag,
      boxSelect,
      entityDrag,
      floor,
      dispatch,
      entityHover
    } = this.props;

    // mouseEnter will not be called if the mouse starts in the container,
    // so spoof it
    if (!this.state.hoveringOnContainer) {
      this.setState({
        hoveringOnContainer: true
      });
      this._emitToTool("mouseEnter");
    }

    // if mouse is down, we're actively doing something
    if (this.state.isMousedown) {

      this._emitToTool("mouseDrag", {
        getTargetEntity: () => this.state.mouseDownEntity,
        cursorPosition2D: pos2,
        cursorPosition3D: pos3
      });

      // in select mode, update selection box
      if (boxSelect && !(entityDrag && this.state.mouseDownEntity)) {
        const selectBox = new Box2()
        .expandByPoint(this.state.dragStart2D)
        .expandByPoint(pos2);
        this.setState({
          dragging: true,
          cursorPosition2D: pos2,
          cursorPosition3D: pos3,
          selectionBBox2: selectBox
        });
      }
      // in drag mode, drag camera
      else if (cameraDrag) {
        const delta3 = this.state.dragStart3D.clone().sub(pos3);
        this.setState({
          cameraPosition: this.dragCamera.position.clone().add(delta3),
          cursorPosition2D: pos2,
          cursorPosition3D: pos3,
          dragging: true
        });
        this._requestRender();
      }
      // in entity drag mode, drag things
      else if (entityDrag) {
        let stateUpdate = null;
        const delta3 = this.state.dragStart3D.clone().sub(pos3);
        let { draggingEntities } = this.state;

        // only evaluate this at the start of the drag!
        if (!draggingEntities) {
          const { mouseDownEntity, mouseDownSelection } = this.state;
          // drag selection if entity is part of it
          if (
            mouseDownEntity && mouseDownSelection &&
            mouseDownSelection.get(mouseDownEntity.get("id"))
          ) {
            draggingEntities = floor.get("entities")
            .filter(e => mouseDownSelection.get(e.get("id")));
            // this only applies to boundaries - otherwise, would break
            // snapping behavior (brittle)
            draggingEntities = draggingEntities
            .merge(floor.getLinkedPoints(draggingEntities))
            .merge(floor.getLinkedObjects(draggingEntities));
          }
          // otherwise, only drag the entity and its dependencies
          else if (mouseDownEntity){
            draggingEntities = floor.get("entities")
            .filter(e => (e.get("id") === mouseDownEntity.get("id")));
            // this only applies to boundaries - otherwise, would break
            // snapping behavior (brittle)
            draggingEntities = draggingEntities
            .merge(floor.getLinkedPoints(draggingEntities))
            .merge(floor.getLinkedObjects(draggingEntities));
          }
          stateUpdate = {
            dragging: true,
            draggingEntities,
            cursorPosition2D: pos2,
            cursorPosition3D: pos3
          };
        }
        // fallback - just drag, nothing more
        else {
          stateUpdate = {
            dragging: true,
            cursorPosition2D: pos2,
            cursorPosition3D: pos3
          };
        }

        // apply drag updates to scene
        if (draggingEntities && draggingEntities.count()) {
          let snapGuides = null;
          let pendingDragEntities = draggingEntities.map(e => {
            switch (e.get("type")) {
            case "point":
            case "object":
              return e.merge({
                x: e.get("x") - delta3.x,
                y: e.get("y") - delta3.y
              });
            default:
              return e;
            }
          });
          // apply snapping and object attachment behavior
          if (draggingEntities.count() === 1) {
            stateUpdate.snappedToEntity = null;
            const [
              snappedEntity,
              snappedToEntity,
              snappedToGuides
            ] = this._snapDragEntity(pendingDragEntities.valueSeq().first());
            if (snappedEntity) {
              pendingDragEntities = new Map({
                [snappedEntity.get("id")]: snappedEntity
              });
              stateUpdate.snappedToEntity = snappedToEntity;
              snapGuides = snappedToGuides;
            }
          }
          this.setState(stateUpdate);
          dispatch(updatePendingEntities(pendingDragEntities, { snapGuides }));
        }
        else {
          this.setState(stateUpdate);
        }
      }
    }
    // otherwise, resolve hover and update state to allow re-render
    else {
      const hoveringOnEntity = entityHover ?
        this._resolveEntityAtPosition3(pos3) :
        null;
      this.setState({
        cursorPosition2D: pos2,
        cursorPosition3D: pos3,
        hoveringOnEntity
      });
      this._emitToTool("mouseMove", {
        hoveringOnEntity,
        cursorPosition2D: pos2,
        cursorPosition3D: pos3
      });
    }
  }
  // simplified snapping
  // makes it easier to tell
  // what to do on drag
  //
  // returns modified entity, snap target entity, snap target guides
  _snapDragEntity (entity) {
    const {
      floor,
      snapInstanceTypes,
      enableSnapGuides
    } = this.props;
    const entityType = entity.get("type");
    let canSnapToPoints = false;
    let canSnapToBoundaries = false;
    let canSnapToGuides = false;
    let pos3;
    switch (entityType) {
    case "point":
      canSnapToPoints = true;
      canSnapToGuides = enableSnapGuides;
      pos3 = entity.toVector3();
      break;
    case "object":
      canSnapToBoundaries = snapInstanceTypes[entity.get("objectType")] || false;
      canSnapToGuides = !snapInstanceTypes[entity.get("objectType")] && enableSnapGuides;
      pos3 = new Vector3(entity.get("x"), entity.get("y"));
      break;
    }
    if (canSnapToPoints || canSnapToBoundaries) {
      const [snapToInstance, snapToPosition] = this._resolveEntitySnap({
        entity,
        snapPoints: canSnapToPoints,
        snapBoundaries: canSnapToBoundaries
      });
      if (snapToInstance) {
        if (
          (entityType === "object") &&
          (snapToInstance.get("type") === "boundary")
        ) {
          return [
            // an object was snapped
            entity.attachToBoundary(snapToInstance, floor.get("entities")),
            // attached to a boundary
            snapToInstance,
            // without any guides
            null
          ];
        }
        return [
          // an entity was
          entity.merge({
            x: snapToPosition.x,
            y: snapToPosition.y
          }),
          // snapped to a scene entity
          snapToInstance,
          // not an extension
          null
        ];
      }
      if (entityType === "object") {
        return [entity.set("attachedToBoundary", null), null, null];
      }
    }
    if (canSnapToGuides && pos3) {
      const snapRes = this.guideSnapper.getBestSnap(floor, pos3);
      const snapToPosition = snapRes[2];
      if (snapToPosition) {
        return [
          // an entity was
          entity.merge({
            x: snapToPosition.x,
            y: snapToPosition.y
          }),
          // modified but not snapped to
          null,
          // anything but guides
          snapRes[0]
        ];
      }
    }
    return [null, null, null];
  }
  _handleMouseEnter () {
    this.setState({
      hoveringOnContainer: true
    });
    this._emitToTool("mouseEnter");
  }
  _handleMouseLeave () {
    this.setState({
      hoveringOnContainer: false,
      cursorPosition2D: null,
      cursorPosition3D: null
    });
    this._emitToTool("mouseLeave");
  }
  _handleKeyDownState (event) {
    const { dispatch, floor, disableMutatuonKeyEvents } = this.props;
    const { hoveringOnContainer } = this.state;
    if (!hoveringOnContainer || disableMutatuonKeyEvents) {
      return;
    }
    const speed = 200;
    let selection;
    let cameraPosition = this.state.cameraPosition.clone();
    switch (event.key) {
    case "ArrowRight":
      cameraPosition.x -= speed;
      this.setState({ cameraPosition });
      break;
    case "ArrowLeft":
      cameraPosition.x += speed;
      this.setState({ cameraPosition });
      break;
    case "ArrowUp":
      cameraPosition.y += speed;
      this.setState({ cameraPosition });
      break;
    case "ArrowDown":
      cameraPosition.y -= speed;
      this.setState({ cameraPosition });
      break;
    case "Backspace":
    case "Delete":
      selection = floor.get("selection");
      if (selection && selection.count()) {
        dispatch(deselectEntities());
        dispatch(deleteEntities(selection));
      }
      break;
    default:
      break;
    }
  }
  /**
   * Resolves the location of a cursor in 2-space and 3-space given an event
   * with clientX, clientY.
   * @param event: an event (most likely synthetic) for a cursor action
   * @returns [pos in 2D, pos in 3D]
   */
  _resolveCursorEventPosition (event) {

    // resolve raw 2D position (from top left)
    const containerRect = this.container.getBoundingClientRect();
    const x = event.clientX - containerRect.left;
    const y = event.clientY - containerRect.top;
    const pos2Raw = new Vector2(x, y);

    // resolve 3D position via plane/ray intersect
    const { width, height } = this._resolveCanvasSize();
    const pos2 = new Vector2(2 * x / width - 1, 1 - 2 * y / height);
    const cursorRaycaster = new Raycaster();
    const cursorCamera = this.dragCamera || this.camera;
    const cursorPlane = this.dragPlane || new Plane(UP, 1);
    cursorRaycaster.setFromCamera(pos2, cursorCamera);
    const pos3 = cursorRaycaster.ray.intersectPlane(cursorPlane);

    // return both
    return [pos2Raw, pos3];
  }
  /**
   * Resolves the bounding boxes in 2-space and 3-space of a given set of
   * entities
   */
  _resolveEntityBoundingBoxes (entities) {
    const bbox3 = new Box3();
    entities.keySeq().forEach(k => {
      const sceneEntity = this.sceneEntityMap[k];
      if (sceneEntity && sceneEntity.geometry.vertices) {
        sceneEntity.geometry.vertices.forEach(v => bbox3.expandByPoint(v));
      }
      else if (sceneEntity && sceneEntity.geometry.attributes){
        if (sceneEntity.geometry.attributes.position) {
          const positionArr = sceneEntity.geometry.attributes.position.array;
          for (let pi=0; pi<positionArr.length; pi+=3) {
            bbox3.expandByPoint(
              new Vector3(positionArr[pi], positionArr[pi+1], positionArr[pi+2])
            );
          }
        }
      }
    });
    const bbox2 = this._resolveBox2ForBox3(bbox3);
    return [bbox2, bbox3];
  }
  // resolves bbox2 for a given box3
  _resolveBox2ForBox3 (bbox3) {
    const width = this.state.containerSize.x;
    const height = this.state.containerSize.y;
    const bbox2 = new Box2();
    bbox3.getCorners().forEach(v => {
      v.project(this.camera);
      v.x = (v.x + 1) * width / 2;
      v.y = (1 - v.y) * height / 2;
      bbox2.expandByPoint(v);
    });
    return bbox2;
  }
  _resolveLocation2 (v) {
    const width = this.state.containerSize.x;
    const height = this.state.containerSize.y;
    const projectedV = new Vector3().copy(v).setZ(0).project(this.camera);
    projectedV.x = (projectedV.x + 1) * width / 2;
    projectedV.y = (1 - projectedV.y) * height / 2;
    return projectedV;
  }
  // call this to trigger a render!
  _requestRender () {
    this.needsRender = true;

    // start render cycle if necessary
    if (!this.rendering) {
      this.rendering = true;
      this._renderFrame();
    }
  }
  // avoid direct calls
  _renderFrame () {
    // only re-render if necessary
    if (this.needsRender) {
      this.renderer.render(this.scene, this.camera);
      this.needsRender = false;
    }
    // but always schedul the next check
    requestAnimationFrame(this._renderFrame.bind(this));
  }
  // call to allow tools to act on mouse events
  _emitToTool(eventName, rawEventData = {}) {
    const { dispatch, activeTool } = this.props;
    const callbackName = `on${eventName[0].toUpperCase()}${eventName.slice(1)}`;
    const eventData = Object.assign({
      viewport: this,
      dispatch
    }, rawEventData);
    if (activeTool && activeTool[callbackName]) {
      activeTool[callbackName](eventData);
    }
    this.mouseEventEmitter.emit(eventName, eventData);
  }
  // call to get snap targets for a given position, radius
  _resolveEntitySnap ({
    position,
    entity,
    radius,
    snapPoints = true,
    snapBoundaries = true,
    snapDimensionLines = false,
    pointBias = 1,
    lineBias = 1
  } = {}) {
    let position2, ignoreId;
    if (entity) {
      position2 = new Vector2(entity.get("x"), entity.get("y"));
      ignoreId = entity.get("id");
    }
    else if (position) {
      position2 = position;
    }
    else {
      throw new Error("must supply position or entity to _resolveEntitySnap");
    }
    const { floor } = this.props;
    const entities = floor.get("entities");
    const snaps = this.hr.resolveInRadiusWithSnapPositions(
      position2,
      radius || this.hr.pointRadius || 10,
      snapPoints,
      snapBoundaries,
      pointBias,
      lineBias
    );
    for (let si=0; si<snaps.length; si++) {
      const { id, snapPosition } = snaps[si];
      const snapEntity = entities.get(id);
      if (!snapEntity || (ignoreId === id)) {
        continue;
      }
      const snapEntityType = snapEntity.get("type");
      if (snapPoints && snapEntityType === "point") {
        return [snapEntity, snapPosition];
      }
      else if (snapBoundaries && (snapEntityType === "boundary")) {
        const boundaryType = snapEntity.get("boundaryType");
        if (!snapDimensionLines && (boundaryType === "dimension-line")) {
          continue;
        }
        return [snapEntity, snapPosition];
      }
    }
    return [null, null];
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
  render () {
    const {
      width,
      height,
      cameraDrag,
      activeTool,
      boxSelect,
      clickSelect,
      entityTransformOverlay,
      floor,
      dispatch
    } = this.props;

    const {
      dragging,
      hoveringOnEntity,
      cursorPosition2D,
      cursorPosition3D,
      selectionBBox2,
      lastCameraSync
    } = this.state;

    let toolOverlay = null;
    if (boxSelect && dragging) {
      toolOverlay = <SelectBoxOverlay bbox2={selectionBBox2}/>;
    }
    else if (entityTransformOverlay) {
      const selection = floor.get("selection");
      const selectionSize = selection.count();
      let showOverlay = false;
      if (selectionSize === 1) {
        const selectedEntityID = selection.first();
        switch(floor.getIn(["entities", selectedEntityID, "type"])) {
        case "boundary":
          showOverlay = true;
          break;
        default:
          break;
        }
      } else if (selectionSize > 1) {
        showOverlay = true;
      }
      if (showOverlay) {
        toolOverlay = <TransformOverlay {...{
          floor,
          viewport: this,
          lastCameraSync,
          dispatch,
          viewportEvents: this.mouseEventEmitter,
          setCursor: cursor => this._defaultCursor = cursor || null
        }}/>;
      }
      else if (this._defaultCursor) {
        this._defaultCursor = null;
      }
    }
    else if (!dragging) {
      if (activeTool && activeTool.getViewportOverlay) {
        toolOverlay = activeTool.getViewportOverlay ({
          viewport: this,
          viewportEvents: this.mouseEventEmitter,
          cursorPosition2D,
          cursorPosition3D,
          dragging,
          setCursor: cursor => this._defaultCursor = cursor || null
        });
      }
    }
    let cursor = this._defaultCursor;
    let cursorHintOverlay = null;
    if (!cursor) {
      if (cameraDrag) {
        cursor = "-webkit-grabbing";
      }
      else if (clickSelect && hoveringOnEntity) {
        cursor = "pointer";
      }
      else {
        cursor = "default";
      }
    }
    if (activeTool && activeTool.cursorHint) {
      cursorHintOverlay = (
        <CursorHintOverlay
          text={activeTool.cursorHint}
          cursorPositon={cursorPosition2D}
        />
      );
    }
    return (
      <div
        {...{ width, height }}
        onMouseEnter={e => this._handleMouseEnter(e)}
        onMouseLeave={e => this._handleMouseLeave(e)}
        onMouseMove={e => this._handleMouseMove(e)}
        onMouseDown={e => this._handleMouseDown(e)}
        onMouseUp={e => this._handleMouseUp(e)}
        onKeyDown={e => this._handleKeyDownState(e)}
        ref={ r => this.container = r }
        tabIndex="0"
        style={{
          cursor,
          position: "relative",
          overflow: "hidden",
          width,
          height
        }}
      >
        { cursorHintOverlay }
        { toolOverlay }
        <canvas className="st-fpc-canvas" ref={ r => this.canvas = r } />
      </div>
    );
  }
}

const mapToolToProps = (tool = {}) => ({
  cameraDrag: tool.enableDragPan,
  boxSelect: tool.enableBoxSelect,
  clickSelect: tool.enableClickSelect,
  entityDrag: tool.enableDragTranslate,
  entityHover: !tool.disableEntityHover,
  disableMutatuonKeyEvents: tool.disableMutatuonKeyEvents,
  entityTransformOverlay: tool.enableTransformOverlay
});
const mapStateToProps = ({ floor, editor }) => ({
  floor: floor.present || Map(),
  activeTool: editor.get("activeTool"),
  colorScheme: editor.get("colorScheme"),
  sceneFrame: editor.get("sceneFrame"),
  hiddenBoundaryTypes: null,
  newBoundaryType: editor.get("newBoundaryType"),
  newObjectType: editor.get("newObjectType"),
  snapToNearby: 20,
  snapInstanceTypes: { "door": true, "double-door": true, "window": true },
  measurementFontSize: 10,
  enableSnapGuides: editor.get("enableSnapGuides"),
  snapGuides: editor.get("visibleSnapGuides"),
  ...mapToolToProps(editor.get("activeTool"))
});

// add getCorners to Box3 (pending merge into 3JS core)
Box3.prototype.getCorners = function() {
  const { min, max } = this;
  return [
    new Vector3(min.x, min.y, min.z),
    new Vector3(min.x, min.y, max.z),
    new Vector3(min.x, max.y, min.z),
    new Vector3(min.x, max.y, max.z),
    new Vector3(max.x, min.y, min.z),
    new Vector3(max.x, min.y, max.z),
    new Vector3(max.x, max.y, min.z),
    new Vector3(max.x, max.y, max.z)
  ];
};

export default connect(mapStateToProps)(Viewport);

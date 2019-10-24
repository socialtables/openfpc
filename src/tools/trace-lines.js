import { Component } from "react";
import { connect } from "react-redux";
import { Map } from "immutable";
import { Box3, Box2, Vector3, Vector2 } from "three";
import { Point, Boundary } from "../model";
import { TRACE_LINES_TOOL_NAME } from "../constants/tools";
import { BaseButton } from "./base";
import {
  updatePendingEntities,
  applyPendingUpdate
} from "../actions/floor-actions";
import CollisionResolverMaintainer from "../lib/collision-resolver-maintainer";
import Worker from "../lib/trace-lines.worker.js";
import {
  LineSegment,
  combineSegments,
  removeSmallAndOddAngleSegments,
  intersectAllSegmentsAndGetSceneEntities,
  segmentsFromSceneEntitiesMap,
  sliceSegment,
  dedupPoints
} from "../lib/segment-intersection";

const IMAGE_WINDOW_SIZE = 128;

// delegate line recognition to a webworker
let worker;
let workerInitialized = false;
function getWorker () {
  if (!worker) {
    worker = new Worker();
  }
  return worker;
}

const ToolButton = BaseButton(TRACE_LINES_TOOL_NAME);

export default class TraceLinesTool {
  constructor () {
    this.name = TRACE_LINES_TOOL_NAME;
    this.disableEntityHover = true;
    this.toolButton = (
      <ToolButton additionalClasses={["arc-tool-button"]}>
        <div>trace</div>
        <div>lines</div>
      </ToolButton>
    );
  }
  getViewportOverlay ({ viewport }) {
    const { floor, dispatch } = viewport.props;
    const { lastCameraSync } = viewport.state;
    return <_TraceLinesToolOverlay {...{
      viewport,
      floor,
      lastCameraSync,
      dispatch
    }}/>;
  }
}

class TraceLinesToolOverlay extends Component {
  constructor (props) {
    super(props);
    this.state = {
      workerInitialized: false,
      noBackground: false,

      dragging: false,
      dragOirgin: null,
      pendingProtoBoundaries: null,
      pendingBoundaries: null
    };
    this.overlay = null;
    this.canvas = null;
    this.worker = null;
    this.latestTraceResult = null;
    this.pendingSegments = null;
    this.crMaintainer = new CollisionResolverMaintainer();
    this._onMouseMove = this._onMouseMove.bind(this);
    this._onMouseDown = this._onMouseDown.bind(this);
    this._onMouseUp = this._onMouseUp.bind(this);
    this._onWorkerMessage = this._onWorkerMessage.bind(this);
  }
  componentDidMount () {
    this.worker = getWorker();
    this.worker.addEventListener("message", this._onWorkerMessage);

    // isolate the background image we'll be tracing over
    const scene = this.props.viewport.scene;
    let bgImageMesh;
    scene.traverse(mesh => {
      if (mesh.name === "backgroundImage") {
        bgImageMesh = mesh;
      }
    });
    if (!bgImageMesh) {
      this.setState({
        noBackground: true
      });
      return;
    }
    const bgImage = bgImageMesh.material.map.image;
    this.setState({
      workerInitialized,
      bgImageMesh,
      bgImage
    });

    // set up mouse motion listeners
    this.overlay.addEventListener("mousemove", this._onMouseMove);
    this.overlay.addEventListener("mousedown", this._onMouseDown);
    this.overlay.addEventListener("mouseup", this._onMouseUp);

    // set up canvas objects for sub-image sampling
    this.canvas = document.createElement("canvas");
    this.canvas.setAttribute("width", IMAGE_WINDOW_SIZE);
    this.canvas.setAttribute("height", IMAGE_WINDOW_SIZE);
    this.overlay.appendChild(this.canvas);

    this.resultsCanvas = document.createElement("canvas");
    this.resultsCanvas.setAttribute("width", IMAGE_WINDOW_SIZE);
    this.resultsCanvas.setAttribute("height", IMAGE_WINDOW_SIZE);
    this.overlay.appendChild(this.resultsCanvas);
  }
  componentWillUnmount () {
    this.worker.removeEventListener("message", this._onWorkerMessage);
  }
  _onWorkerMessage ({ data }) {
    switch (data.type) {
    case "init":
      workerInitialized = true;
      this.setState({ workerInitialized });
      break;
    case "return-frame": {
      const resultsCtx = this.resultsCanvas.getContext("2d");
      resultsCtx.putImageData(data.imageData, 0, 0);
      this.latestTraceResult = this._localizeTraceResult({
        centerX: data.centerX,
        centerY: data.centerY,
        lines: data.lines
      });
      break;
    }
    }
  }
  _localizeTraceResult (traceResult) {
    const { bgImageMesh, bgImage } = this.state;
    const { centerX, centerY, lines } = traceResult;
    const bgImageMeshBBox = new Box3().expandByObject(bgImageMesh);
    const bgMeshSize = bgImageMeshBBox.getSize(new Vector3());
    function bgPositionRelative ({ x: sampleImgX , y: sampleImgY }) {
      // convert to image coordinates
      let bgImgX = sampleImgX + centerX - IMAGE_WINDOW_SIZE / 2;
      let bgImgY = sampleImgY + centerY - IMAGE_WINDOW_SIZE / 2;
      bgImgX /= bgImage.naturalWidth;
      bgImgY /= bgImage.naturalHeight;
      const x = bgImageMeshBBox.min.x + bgImgX * bgMeshSize.x;
      const y = bgImageMeshBBox.min.y + bgImgY * bgMeshSize.y;
      return new Vector2(x, y);
    }
    const lineScale = bgMeshSize.x / bgImage.naturalWidth;
    return {
      lines: lines.map(l => new LineSegment({
        origin: bgPositionRelative(l.center),
        tangent: new Vector2(l.tangent.x, l.tangent.y),
        minExtent: - l.length * 0.5 * lineScale,
        maxExtent: l.length * 0.5 * lineScale,
        weight: l.length
      }))
    };
  }
  _onMouseMove (e) {
    const { viewport } = this.props;
    const { noBackground, bgImageMesh, bgImage } = this.state;
    if (noBackground) {
      return;
    }

    // find the 3D and image coordinates of the current cursor
    const [ _, pos3 ] = viewport._resolveCursorEventPosition(e); // eslint-disable-line no-unused-vars
    const bgMeshBBox = new Box3().expandByObject(bgImageMesh);
    const bgMeshSize = bgMeshBBox.getSize(new Vector3());
    const bgPositionRelative = pos3
    .clone()
    .sub(bgMeshBBox.min)
    .divide(bgMeshSize)
    .setZ(0);
    const bgPositionInPixels = bgPositionRelative.clone();
    bgPositionInPixels.x *= bgImage.naturalWidth;
    bgPositionInPixels.y *= bgImage.naturalHeight;

    // round to nearest pixel
    bgPositionInPixels.x = Math.floor(bgPositionInPixels.x);
    bgPositionInPixels.y = Math.floor(bgPositionInPixels.y);

    // send the area in question to the worker process for tracing
    const ctx = this.canvas.getContext("2d");
    ctx.clearRect(0, 0, IMAGE_WINDOW_SIZE, IMAGE_WINDOW_SIZE);
    ctx.drawImage(
      bgImage,
      bgPositionInPixels.x - IMAGE_WINDOW_SIZE / 2,
      bgPositionInPixels.y - IMAGE_WINDOW_SIZE / 2,
      IMAGE_WINDOW_SIZE,
      IMAGE_WINDOW_SIZE,
      0,
      0,
      IMAGE_WINDOW_SIZE,
      IMAGE_WINDOW_SIZE
    );
    const imageData = ctx.getImageData(0, 0, IMAGE_WINDOW_SIZE, IMAGE_WINDOW_SIZE);
    this.worker.postMessage({
      type: "frame",
      x: bgPositionInPixels.x,
      y: bgPositionInPixels.y,
      imageData
    });

    // perform actual dragging operation
    if (this.state.dragging) {
      this._onMouseDrag(pos3);
    }
  }
  _onMouseDown (e) {
    const { viewport } = this.props;
    const [ _, pos3 ] = viewport._resolveCursorEventPosition(e); // eslint-disable-line no-unused-vars
    this.crMaintainer.syncFloorState(viewport.props.floor);
    this.dragStartEntities = viewport.props.floor.get("entities");
    this.setState({
      dragging: true,
      dragOrigin: pos3
    });
    this._onMouseDrag();
  }
  _onMouseDrag () {
    const { dispatch } = this.props;
    const { lines: newLines } = this.latestTraceResult || {};
    if (!newLines || !newLines.length) {
      return;
    }

    // combine new segments with pending segments
    this.pendingSegments = combineSegments(this.pendingSegments || [], newLines);

    // dump everything into the scene
    const pendingEntityObj = {};
    this.pendingSegments.forEach(seg => {
      const start3 = seg.origin.clone().add(seg.tangent.clone().multiplyScalar(seg.minExtent));
      const end3 = seg.origin.clone().add(seg.tangent.clone().multiplyScalar(seg.maxExtent));
      const start = Point.fromJS(start3).set("id", seg.startId);
      const end = Point.fromJS(end3).set("id", seg.endId);
      const boundary = new Boundary({
        start: seg.startId,
        end: seg.endId
      });
      pendingEntityObj[seg.startId] = start;
      pendingEntityObj[seg.endId] = end;
      pendingEntityObj[boundary.get("id")] = boundary;
    });
    const pendingEntityMap = new Map(pendingEntityObj);
    dispatch(updatePendingEntities(pendingEntityMap));
  }
  _onMouseUp (e) {
    const { viewport, dispatch } = this.props;
    const [ _, pos3 ] = viewport._resolveCursorEventPosition(e); // eslint-disable-line no-unused-vars
    this.setState({
      dragging: false,
      dragOrigin: null
    });
    let pendingSegments = this.pendingSegments;
    this.pendingSegments = null;

    // find all boundaries that we collided with and cut segments down to
    // avoid / intersect them
    const sceneEntities = this.dragStartEntities;
    const collisionResolver = this.crMaintainer.cr;
    const bbox = new Box2();
    const culledSegments = [];
    const anchorPointsById = {};
    pendingSegments.forEach(seg => {
      bbox.makeEmpty();
      bbox.expandByPoint(
        seg.tangent.clone().multiplyScalar(seg.minExtent).add(seg.origin)
      );
      bbox.expandByPoint(
        seg.tangent.clone().multiplyScalar(seg.maxExtent).add(seg.origin)
      );
      bbox.expandByScalar(1);
      const entityIdsInBBox = collisionResolver.resolveSelectionBox(bbox, false);
      const entitiesInBBox = entityIdsInBBox.map(id => sceneEntities.get(id));
      const boundariesInBBox = entitiesInBBox.filter(e => e && e.get("type") === "boundary");
      entitiesInBBox.forEach(e => {
        if (e.get("type") === "point") {
          anchorPointsById[e.get("id")] = e;
        }
      });
      const boundariesAsSegments = segmentsFromSceneEntitiesMap(sceneEntities, boundariesInBBox);
      culledSegments.push(...sliceSegment(seg, boundariesAsSegments));
    });

    pendingSegments = culledSegments;

    // remove segments that don't belong
    pendingSegments = removeSmallAndOddAngleSegments(pendingSegments);

    // intersect all remaining segments
    const segEntitiesMap = intersectAllSegmentsAndGetSceneEntities(pendingSegments);

    // merge nearby points
    const finalEntitiesMap = dedupPoints(segEntitiesMap, new Map(anchorPointsById));

    // and we're done!
    dispatch(applyPendingUpdate(finalEntitiesMap));
  }
  render () {
    let content = null;
    if (!this.state.workerInitialized) {
      content = <div className="full-screen-message">
        <div>Initializing tool...</div>
      </div>;
    }
    else if (this.state.noBackground) {
      content = <div className="full-screen-message">
        <div>Cannot initialize tool; no background image found.</div>
      </div>;
    }
    else {
      content = null;
    }
    return <div
      className="trace-lines-viewport-overlay"
      ref={ el => this.overlay = el }
    >
      { content }
    </div>;
  }
}

const _TraceLinesToolOverlay = connect(
  function mapStateToProps () {
    return {};
  }
)(TraceLinesToolOverlay);

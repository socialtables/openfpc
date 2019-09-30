import { Component } from "react";
import { connect } from "react-redux";
import { Map } from "immutable";
import { Box3, Vector3, Vector2 } from "three";
import shortid from "shortid";
import { checkIntersection } from "line-intersect";
import { Point, Boundary } from "../model";
import { TRACE_LINES_TOOL_NAME } from "../constants/tools";
import { BaseButton } from "./base";
import {
  updatePendingEntities,
  applyPendingUpdate
} from "../actions/floor-actions";
import Worker from "../lib/trace-lines.worker.js";

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
      lines: lines.map(l => ({
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
    this.setState({
      dragging: true,
      dragOrigin: pos3
    });
    this._onMouseDrag();
  }
  _onMouseDrag () {
    const { dispatch } = this.props;
    const newLines = this.latestTraceResult.lines;
    let pendingSegments = this.pendingSegments || [];

    // join lines to pending segments
    // this works much like it does for line combination but uses an algorithm
    // more suited to growing lines
    const segMergeDistThreshold = 1;
    const segMergeDotThreshold = 0.98;
    newLines.forEach(newLine => {
      let mergedWithSegment = null;
      pendingSegments.forEach(seg => {
        // don't merge if the segment was merged and is scheduled for removal
        // in the next pass
        if (seg.merged) {
          return;
        }
        let segDot = seg.tangent.dot(newLine.tangent);
        let segFlipped = false;
        if (segDot < 0) {
          segFlipped = true;
          segDot = segDot * -1;
        }
        // don't merge if directions aren't similar
        if (segDot < segMergeDotThreshold) {
          return;
        }
        const lineOriginOffset = newLine.origin.clone().sub(seg.origin);
        // don't merge if line is too far away (segment normal)
        const distanceFromSegLine = Math.abs(seg.tangent.cross(lineOriginOffset));
        if (distanceFromSegLine > segMergeDistThreshold) {
          return;
        }
        // find the relative bounds of the new line relative to the segment
        let minExtent = Infinity;
        let maxExtent = -Infinity;
        [
          lineOriginOffset.clone().add(newLine.tangent.clone().multiplyScalar(newLine.minExtent)),
          lineOriginOffset.clone().add(newLine.tangent.clone().multiplyScalar(newLine.maxExtent))
        ]
        .forEach(lineEndpointOffset => {
          minExtent = Math.min(minExtent, seg.tangent.dot(lineEndpointOffset));
          maxExtent = Math.max(maxExtent, seg.tangent.dot(lineEndpointOffset));
        });
        if ((minExtent <= seg.maxExtent) && (maxExtent >= seg.minExtent)) {
          // if not yet merged, attempt to do so
          if (!mergedWithSegment) {
            mergedWithSegment = seg;
            const segRelativeWeight = seg.weight / (newLine.weight + seg.weight);
            const newLineRelativeWeight = 1 - segRelativeWeight;
            const endpoints = [
              seg.tangent.clone().multiplyScalar(seg.maxExtent).add(seg.origin),
              seg.tangent.clone().multiplyScalar(seg.minExtent).add(seg.origin),
              newLine.tangent.clone().multiplyScalar(newLine.minExtent).add(newLine.origin),
              newLine.tangent.clone().multiplyScalar(newLine.maxExtent).add(newLine.origin)
            ];
            seg.tangent.multiplyScalar(segRelativeWeight).add(newLine.tangent.clone().multiplyScalar(newLineRelativeWeight * (segFlipped ? -1 : 1)));
            seg.tangent.normalize();
            seg.origin = seg.origin.clone().multiplyScalar(segRelativeWeight).add(newLine.origin.clone().multiplyScalar(newLineRelativeWeight));
            seg.weight += newLine.weight;
            seg.minExtent = Infinity;
            seg.maxExtent = -Infinity;
            endpoints.forEach(p => {
              seg.minExtent = Math.min(seg.minExtent, p.clone().sub(seg.origin).dot(seg.tangent));
              seg.maxExtent = Math.max(seg.maxExtent, p.clone().sub(seg.origin).dot(seg.tangent));
            });
          }
          // otherwise, merge this segment with the merged segment since we
          // just connected two isolated segments
          else {
            const merged = mergedWithSegment;
            merged.merged = true;
            const mergedFlipped = merged.tangent.dot(seg.tangent) < 0;
            const segRelativeWeight = seg.weight / (merged.weight + seg.weight);
            const mergedRelativeWeight = 1 - segRelativeWeight;
            const endpoints = [
              seg.tangent.clone().multiplyScalar(seg.maxExtent).add(seg.origin),
              seg.tangent.clone().multiplyScalar(seg.minExtent).add(seg.origin),
              merged.tangent.clone().multiplyScalar(merged.maxExtent).add(merged.origin),
              merged.tangent.clone().multiplyScalar(merged.minExtent).add(merged.origin)
            ];
            seg.tangent.multiplyScalar(segRelativeWeight).add(merged.tangent.clone().multiplyScalar(mergedRelativeWeight * (mergedFlipped ? -1 : 1)));
            seg.tangent.normalize();
            seg.origin = seg.origin.clone().multiplyScalar(segRelativeWeight).add(merged.origin.clone().multiplyScalar(mergedRelativeWeight));
            seg.weight += merged.weight;
            seg.minExtent = Infinity;
            seg.maxExtent = -Infinity;
            endpoints.forEach(p => {
              seg.minExtent = Math.min(seg.minExtent, p.clone().sub(seg.origin).dot(seg.tangent));
              seg.maxExtent = Math.max(seg.maxExtent, p.clone().sub(seg.origin).dot(seg.tangent));
            });
          }
        }
      });
      if (!mergedWithSegment) {
        const newSegment = {
          // we use these to maintain stable IDs in the scene while drawing
          startId: shortid.generate(),
          endId: shortid.generate(),
          id: shortid.generate(),
          // we use these for intersection
          origin: newLine.origin,
          tangent: newLine.tangent,
          minExtent: newLine.minExtent,
          maxExtent: newLine.maxExtent,
          weight: newLine.weight,
          merged: false,
          // we use these during the cleanup phase
          isValid: true,
          oddIntersections: 0,
          intersections: []
        };
        pendingSegments.push(newSegment);
      }
    });

    pendingSegments = pendingSegments.filter(seg => !seg.merged);
    this.pendingSegments = pendingSegments;

    // dump everything into the scene
    const pendingEntityObj = {};
    pendingSegments.forEach(seg => {
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

    // remove segments that don't belong
    let totalWeight = 0;
    pendingSegments.forEach(seg => totalWeight += seg.weight);
    const averageWeight = totalWeight / (pendingSegments.length || 1);
    for (let a = 0; a < pendingSegments.length; a++) {
      const segA = pendingSegments[a];
      const startA = segA.tangent.clone().multiplyScalar(segA.minExtent).add(segA.origin);
      const endA = segA.tangent.clone().multiplyScalar(segA.maxExtent).add(segA.origin);
      for (let b = a + 1; b < pendingSegments.length; b++) {
        const segB = pendingSegments[b];
        const aDotB = segA.tangent.dot(segB.tangent);
        if (Math.abs(aDotB) > 0.95 || Math.abs(aDotB) < 0.1) {
          continue;
        }
        const startB = segB.tangent.clone().multiplyScalar(segB.minExtent).add(segB.origin);
        const endB = segB.tangent.clone().multiplyScalar(segB.maxExtent).add(segB.origin);
        const intersect = checkIntersection(startA.x, startA.y, endA.x, endA.y, startB.x, startB.y, endB.x, endB.y);
        if (intersect.type !== "intersecting") {
          continue;
        }
        segA.oddIntersections++;
        segB.oddIntersections++;
      }
      if (segA.oddIntersections >= 2 && segA.weight < averageWeight / 4) {
        segA.isValid = false;
      }
    }

    pendingSegments = pendingSegments.filter(segment => segment.isValid);

    // intersect all remaining segments
    const extendDist = 5;
    const intersectionPoints = [];
    for (let a = 0; a < pendingSegments.length; a++) {
      const segA = pendingSegments[a];
      const startA = segA.tangent.clone().multiplyScalar(segA.minExtent - extendDist).add(segA.origin);
      const endA = segA.tangent.clone().multiplyScalar(segA.maxExtent + extendDist).add(segA.origin);
      for (let b = a + 1; b < pendingSegments.length; b++) {
        const segB = pendingSegments[b];
        const startB = segB.tangent.clone().multiplyScalar(segB.minExtent - extendDist).add(segB.origin);
        const endB = segB.tangent.clone().multiplyScalar(segB.maxExtent + extendDist).add(segB.origin);
        const intersect = checkIntersection(startA.x, startA.y, endA.x, endA.y, startB.x, startB.y, endB.x, endB.y);
        if (intersect.type === "intersecting") {
          const intersectId = shortid.generate();
          const intersectPoint = new Vector2(intersect.point.x, intersect.point.y);
          intersectionPoints.push(Point.fromJS(intersectPoint).set("id", intersectId));
          const intersectExtentA = intersectPoint.clone().sub(segA.origin).dot(segA.tangent);
          segA.intersections.push({
            id: intersectId,
            extent: intersectExtentA
          });
          const intersectExtentB = intersectPoint.clone().sub(segB.origin).dot(segB.tangent);
          segB.intersections.push({
            id: intersectId,
            extent: intersectExtentB
          });
        }
      }
    }

    // compute final segments using raw segments and their intersections
    const minLength = 4;
    const finalEndpoints = [];
    const finalSegments = [];
    pendingSegments.forEach(seg => {
      let startPointIsIntersect = false;
      let endPointIsIntersect = false;
      seg.intersections.forEach(intersect => {
        if (intersect.extent <= seg.minExtent) {
          startPointIsIntersect = true;
        }
        if (intersect.extent >= seg.maxExtent) {
          endPointIsIntersect = true;
        }
      });
      seg.intersections.sort((a, b) => {
        if (a.extent < b.extent) {
          return -1;
        }
        if (a.extent > b.extent) {
          return 1;
        }
        return 0;
      });
      const subSegmentEndpoints = [];
      if (!startPointIsIntersect) {
        subSegmentEndpoints.push({
          id: seg.startId,
          extent: seg.minExtent,
          isEndpoint: true,
          point: seg.tangent.clone().multiplyScalar(seg.minExtent).add(seg.origin)
        });
      }
      subSegmentEndpoints.push(...seg.intersections);
      if (!endPointIsIntersect) {
        subSegmentEndpoints.push({
          id: seg.endId,
          extent: seg.maxExtent,
          isEndpoint: true,
          point: seg.tangent.clone().multiplyScalar(seg.maxExtent).add(seg.origin)
        });
      }
      for (let i = 0; i < subSegmentEndpoints.length - 1; i++) {
        const a = subSegmentEndpoints[i];
        const b = subSegmentEndpoints[i + 1];
        // don't include degenerate end segments in the final result
        if (a.isEndpoint || b.isEndpoint) {
          if (b.extent - a.extent < minLength) {
            continue;
          }
        }
        if (a.isEndpoint) {
          finalEndpoints.push(a);
        }
        if (b.isEndpoint) {
          finalEndpoints.push(b);
        }
        finalSegments.push({
          startId: a.id,
          endId: b.id
        });
      }
    });

    const finalEntitiesObj = {};
    finalEndpoints.forEach(p => {
      const scenePoint = Point.fromJS(p.point).set("id", p.id);
      finalEntitiesObj[scenePoint.get("id")] = scenePoint;
    });
    intersectionPoints.forEach(p => finalEntitiesObj[p.get("id")] = p);
    finalSegments.forEach(s => {
      const sceneBound = new Boundary({
        start: s.startId,
        end: s.endId
      });
      finalEntitiesObj[sceneBound.get("id")] = sceneBound;
    });

    this.pendingSegments = null;
    const finalEntitiesMap = new Map(finalEntitiesObj);
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

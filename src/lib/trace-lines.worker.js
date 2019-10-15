import { Vector2 } from "three";

// this is used to locate the webassembly files for opencv
global.Module = {
  locateFile: (path) => {
    const url = `../wasm/${path}`;
    return url;
  }
};

// pull in vendored webassembly-enabled opencv

function findSomeLines (imageData, centerX, centerY) {
  const cv = require("../vendor/opencv.js");

  // if OpenCV hasn't loaded, don't do anything
  if (!cv.Mat) {
    return;
  }

  const src = cv.matFromImageData(imageData);
  cv.cvtColor(src, src, cv.COLOR_RGBA2GRAY);
  const dst = cv.Mat.zeros(src.rows, src.cols, cv.CV_8UC3);
  const cvlines = new cv.Mat();
  const color = new cv.Scalar(255, 255, 255);

  // run canny edge detection (TODO replace with Tensorflow model)
  cv.Canny(src, src, 50, 100, 3);

  // get raw lines
  cv.HoughLinesP(src, cvlines, 1, Math.PI / 180, 16, 16, 2);
  let lines = [];
  for (let i = 0; i < cvlines.rows; ++i) {
    const dataOffset = i * 4;
    let startPoint = new cv.Point(cvlines.data32S[dataOffset], cvlines.data32S[dataOffset + 1]);
    let endPoint = new cv.Point(cvlines.data32S[dataOffset + 2], cvlines.data32S[dataOffset + 3]);
    const start = new Vector2(startPoint.x, startPoint.y);
    const end = new Vector2(endPoint.x, endPoint.y);
    const center = end.clone().add(start).multiplyScalar(0.5);
    const tangent = end.clone().sub(start);
    const length = tangent.length();
    const weight = length;
    tangent.normalize();
    const merged = false;
    const line = {
      start,
      end,
      center,
      tangent,
      length,
      weight,
      merged
    };
    lines.push(line);
  }

  const minUnmergedLength = 17;
  const mergeIterations = 4;
  const mergeDistance = 4;
  const mergeDot = 0.96;
  let nextLines;
  for (let m = 0; m < mergeIterations; m++) {
    nextLines = [];
    for (let a = 0; a < lines.length; a++) {
      const lineA = lines[a];
      if (lineA.merged) {
        continue;
      }
      for (let b = a + 1; b < lines.length; b++) {
        const lineB = lines[b];
        const lineALineBDot = lineB.tangent.dot(lineA.tangent);
        // don't merge if lines aren't in a similar direction
        if (Math.abs(lineALineBDot) < mergeDot) {
          continue;
        }
        const lineBFlipped = lineALineBDot < 0;
        const lineCenterDelta = lineB.center.clone().sub(lineA.center);
        // don't merge if line is too far away (normal distance)
        if (Math.abs(lineCenterDelta.cross(lineA.tangent)) > mergeDistance) {
          continue;
        }
        // don't  merge if line is too far aray (tangent distance)
        let minTangentProjection = Infinity;
        let maxTangentProjection = -Infinity;
        [
          lineB.start,
          lineB.end
        ].forEach(p => {
          const projectedDist = p.clone().sub(lineA.center).dot(lineA.tangent);
          if (projectedDist < minTangentProjection) {
            minTangentProjection = projectedDist;
          }
          if (projectedDist > maxTangentProjection) {
            maxTangentProjection = projectedDist;
          }
        });
        if (minTangentProjection * maxTangentProjection > 0) {
          const tangentProjectionDistance = Math.min(
            Math.abs(minTangentProjection),
            Math.abs(maxTangentProjection)
          );
          /* eslint-disable max-depth */
          if (tangentProjectionDistance > lineA.length + mergeDistance) {
            continue;
          }
          /* eslint-enable max-depth */
        }
        // go through with the merge
        lineA.merged = true;
        lineB.merged = true;
        const lineARelativeWeight = lineA.weight / (lineA.weight + lineB.weight);
        const lineBRelativeWeight = 1 - lineARelativeWeight;
        lineA.center = lineA.center
        .clone()
        .multiplyScalar(lineARelativeWeight)
        .add(lineB.center.clone().multiplyScalar(lineBRelativeWeight));
        if (lineBFlipped) {
          lineA.tangent
          .multiplyScalar(lineARelativeWeight)
          .sub(lineB.tangent.clone().multiplyScalar(lineBRelativeWeight))
          .normalize();
        }
        else {
          lineA.tangent
          .multiplyScalar(lineARelativeWeight)
          .add(lineB.tangent.clone().multiplyScalar(lineBRelativeWeight))
          .normalize();
        }
        let minBound = 0;
        let maxBound = 0;
        [
          lineA.start,
          lineA.end,
          lineB.start,
          lineB.end
        ].forEach(p => {
          const pDot = p.clone().sub(lineA.center).dot(lineA.tangent);
          if (pDot < minBound) {
            lineA.start = p;
            minBound = pDot;
          }
          else if (pDot > maxBound) {
            lineA.end = p;
            maxBound = pDot;
          }
        });
        lineA.length = maxBound - minBound;
        lineA.weight += lineB.weight;
      }
      if (lineA.merged) {
        lineA.merged = false;
        nextLines.push(lineA);
      }
      else if (lineA.length >= minUnmergedLength) {
        nextLines.push(lineA);
      }
    }
    lines = nextLines;
  }

  for (let l = 0; l < lines.length; l++) {
    const line = lines[l];
    line.start = line.tangent
    .clone()
    .multiplyScalar(-line.length / 2)
    .add(line.center);
    line.end = line.tangent
    .clone()
    .multiplyScalar(line.length / 2)
    .add(line.center);
  }

  // draw lines to output image
  lines.forEach(line => {
    const startPoint = line.start;
    const endPoint = line.end;
    cv.line(dst, startPoint, endPoint, color);
  });

  // send the output image back
  cv.cvtColor(dst, dst, cv.COLOR_RGB2RGBA);
  self.postMessage({
    type: "return-frame",
    imageData: new ImageData(new Uint8ClampedArray(dst.data), dst.cols, dst.rows), // eslint-disable-line no-undef
    centerX,
    centerY,
    lines
  });

  // clean up
  src.delete();
  dst.delete();
  cvlines.delete();
}

function init () {
  self.postMessage({ type: "init" });
  self.addEventListener("message", ({ data }) => {
    switch (data.type) {
    case "frame":
      findSomeLines(data.imageData, data.x, data.y);
      break;
    }
  });
}

// don't initialize if window is defined - it's a trick being played by Jest,
// and jest does not appreciate webassembly
if (typeof window === "undefined") {
  init();
}

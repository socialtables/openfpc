"use strict";
const fs = require("fs");
const THREE = require("three");

const App = require("../dist/index.js");
const { Scene } = App.MODEL;
const { RenderableSceneMaintainer, CollisionResolverMaintainer } = App.LIB;

const {
  Vector2,
  Vector3,
  Box2,
  Box3,
  Color,
  OrthographicCamera,
  WebGLRenderer
} = THREE;

/**
 * Helper for divising a large bounding box into square chunks
 */
function getChunks (bbox, chunkSize) {
  const chunks = [];
  const bboxSize = bbox.getSize();
  for (let cx = 0; cx < (bboxSize.x / chunkSize); cx++) {
    for (let cy = 0; cy < (bboxSize.y / chunkSize); cy++) {
      chunks.push(new Box2(
        new Vector2(
          bbox.min.x + cx * chunkSize,
          bbox.min.y + cy * chunkSize,
        ),
        new Vector2(
          Math.min(bbox.min.x + (cx + 1) * chunkSize, bbox.max.x),
          Math.min(bbox.min.y + (cy + 1) * chunkSize, bbox.max.y)
        )
      ));
    }
  }
  return chunks;
}

/**
 * Generates rasterized chunks of a given scene
 */
module.exports = async function generateTestChunks ({
  containerElement,
  floorData,
  outputFile = "test/chunks",
  spatialChunkSize = 256,
  imageChunkSize = 256
}) {
  const canvasSize = [imageChunkSize, imageChunkSize];
  const canvasElement = document.createElement("canvas");
  containerElement.appendChild(canvasElement);

  const rsMaintainer = new RenderableSceneMaintainer();
  const crMaintainer = new CollisionResolverMaintainer();

  const floorScene = Scene.fromJS(floorData);

  rsMaintainer.syncFloorState(floorScene);
  crMaintainer.syncFloorState(floorScene);

  rsMaintainer.syncColorScheme({
    wall: "#000000",
    object: "#000000"
  });

  const cr = crMaintainer.getResolver();
  const threeScene = rsMaintainer.getScene();
  const threeSceneBBox = new Box3().setFromObject(threeScene);
  const chunks = getChunks(threeSceneBBox, spatialChunkSize);

  const camera = new OrthographicCamera(-10, 10, -10, 10, -100, 100);
  camera.lookAt(new Vector3(0, 0, -1));

  const renderer = new WebGLRenderer({
    canvas: canvasElement,
    preserveDrawingBuffer: true
  });
  renderer.setClearColor(new Color(1, 1, 1));
  renderer.setPixelRatio(1);
  //renderer.setPixelRatio(window.devicePixelRatio || 1);
  renderer.setSize(imageChunkSize, imageChunkSize);

  for (let ci = 0; ci < chunks.length; ci++) {
    const chunk = chunks[ci];
    const chunkCenter = chunk.getCenter();
    camera.position.copy(chunkCenter);
    camera.position.z = 10;
    camera.left   = chunk.min.x - chunkCenter.x;
    camera.right  = chunk.max.x - chunkCenter.x;
    camera.top    = chunk.min.y - chunkCenter.y;
    camera.bottom = chunk.max.y - chunkCenter.y;
    camera.updateProjectionMatrix();

    renderer.render(threeScene, camera);
    await new Promise(resolve => requestAnimationFrame(resolve));

    const rendererDataURL = renderer.domElement.toDataURL();
    const rendererData = rendererDataURL.replace(/^data:image\/\w+;base64,/, "");
    const rendererBuff = new Buffer(rendererData, "base64");

    const chunkIdSet = {};
    cr.resolveSelectionBox(chunk, true).forEach(i => chunkIdSet[i] = 1);
    const entitiesInChunk = floorScene
      .get("entities")
      .valueSeq()
      .filter(e => chunkIdSet[e.get("id")] && (e.get("type") !== "region"))
      .toJS()
      .map(e => {
        switch (e.type) {
          case "boundary": {
            const start = floorScene.getIn(["entities", e.start]).toVector2();
            const end = floorScene.getIn(["entities", e.end]).toVector2();
            const midPoint = end.clone().add(start).multiplyScalar(0.5);
            const angle = end.clone().sub(start).angle();
            return {
              ...e,
              angle,
              midPoint
            };
          }
          default:
            return e;
        }
      });

    if (entitiesInChunk.length) {

      // write chunk image
      fs.writeFileSync(`${outputFile}-${ci}.png`, rendererBuff);

      // write chunk entities list
      const chunkDescriptor = {
        entities: entitiesInChunk,
        bbox: {
          min: { ...chunk.min },
          max: { ...chunk.max }
        }
      };

      fs.writeFileSync(
        `${outputFile}-${ci}.json`,
        JSON.stringify(chunkDescriptor, 0, 2)
      );

    }
  }
};

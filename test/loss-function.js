const { Vector2, Box2 } = require("three");

function computeLoss (prediction, chunk) {
  const predictionCenterPoint = new Vector2(prediction.x, prediction.y);
  const bbox = new Box2(
    new Vector2(chunk.bbox.min.x, chunk.bbox.min.y),
    new Vector2(chunk.bbox.max.x, chunk.bbox.max.y)
  );
  const bboxSize = bbox.getSize();
  let bestMatchScore = 0;
  let bestMatchEntity = null;
  chunk.entities.forEach(e => {
    let { x, y } = e;
    if (e.type === "boundary") {
      x = e.midPoint.x;
      y = e.midPoint.y;
    }
    const entityCenterPoint = new Vector2(x, y);
    entityCenterPoint.sub(bbox.min).multiplyScalar(1 / bboxSize.x);
    const spatialDist = predictionCenterPoint
      .clone()
      .sub(entityCenterPoint)
      .length();

    let entityScore = 1 / Math.max(1, spatialDist);
    if (prediction.type !== e.type) {
      entityScore *= 0.5;
    }
    if (entityScore >= bestMatchScore) {
      bestMatchScore = entityScore;
      bestMatchEntity = e
    }
  });
  return {
    bestMatchScore,
    bestMatchEntity
  };
}

module.exports = computeLoss;

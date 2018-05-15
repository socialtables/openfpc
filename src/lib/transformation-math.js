import { Matrix4 } from "three";

/**
 * Builds a handle-offset-to-screen-space transformation matrix
 * @param bbox2: screen-space bounding box onto which to project handles
 */
export function makeHandlePositionMatrix (bbox2) {
  const bbox2Size = bbox2.getSize();
  const bbox2Center = bbox2.getCenter();
  bbox2Size.x || (bbox2Size.x += 1);
  bbox2Size.y || (bbox2Size.y += 1);
  const scaleMtx = new Matrix4()
  .makeScale(bbox2Size.x, bbox2Size.y, 1);
  const offsetMtx = new Matrix4()
  .makeTranslation(bbox2Center.x, bbox2Center.y, 0);
  return scaleMtx.premultiply(offsetMtx);
}

/**
 * Helper for object resizing in scale transformations
 */
export function getObjectScalingCoefficient (
  origin3,
  handleStartPosition3,
  handleDelta3
) {
  const startLength = handleStartPosition3
  .clone()
  .sub(origin3)
  .length();
  if (startLength === 0) {
    return 1;
  }
  const endLength = handleStartPosition3.clone()
  .add(handleDelta3)
  .sub(origin3)
  .length();
  return endLength / startLength;
}

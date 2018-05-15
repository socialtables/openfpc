"use strict";
const { Vector2 } = require("three");

/**
 * Computes the radius of an arc based on a given a chord length and height
 */
function computeArcRadius(chordLength, arcHeight) {
  return (( arcHeight * arcHeight ) + (chordLength * chordLength / 4)) / (2 * arcHeight);
}

/**
 * Computes the angular spread of an arc given a radius and height
 */
function computeArcAngle(radius, arcHeight) {
  return 2 * Math.acos(1 - (arcHeight / radius));
}

/**
 * Computes points along a given arc, with numPoints interior points
 */
function interpolateArcPointsByCount(startPoint, endPoint, arcHeight, numPoints) {

  const chordLength = endPoint.clone().sub(startPoint).length();
  if (Math.abs(arcHeight / chordLength) < 0.0001) { // reject degenerate cases
    return [];
  }
  const radius = computeArcRadius(chordLength, arcHeight);
  const theta = computeArcAngle(radius, arcHeight) * (arcHeight > 0 ? 1 : -1);

  // identify the component vectors to use in the point fanout
  const chordVector =	endPoint.clone().sub(startPoint).normalize();
  const sagittaVector = new Vector2(-chordVector.y, chordVector.x);
  const centerPoint =
		startPoint.clone()
		.add(chordVector.clone().multiplyScalar(chordLength/2))
		.add(sagittaVector.clone().multiplyScalar(arcHeight-radius));

  // total point count includes edge points (which are not returned)
  const totalNumPoints = numPoints + 1;
  const deltaTheta = theta / totalNumPoints;
  const offsetTheta = (-theta / 2) + deltaTheta;

  // create, return the interpolated points
  const resultPoints = [];
  for (let i=0; i < numPoints; i++) {
    const pointTheta = offsetTheta + (deltaTheta * i);
    resultPoints.push(
      centerPoint.clone()
      .add(sagittaVector.clone().multiplyScalar(radius * Math.cos(pointTheta)))
      .add(chordVector.clone().multiplyScalar(radius * Math.sin(pointTheta)))
    );
  }

  return resultPoints;
}

/**
 * Computes points along a given arc, where the number of points is based
 * on the desired segment length and maximum angle
 */
function interpolateArcPointsByConstraints(startPoint, endPoint, arcHeight, maxSegmentLength, maxAngle) {

  const chordLength = endPoint.clone().sub(startPoint).length();
  if (Math.abs(arcHeight / chordLength) < 0.0001) { // reject degenerate cases
    return [];
  }
  const radius = computeArcRadius(chordLength, arcHeight);
  const theta = computeArcAngle(radius, arcHeight) * (arcHeight > 0 ? 1 : -1);

  // identify the component vectors to use in the point fanout
  const chordVector =	endPoint.clone().sub(startPoint).normalize();
  const sagittaVector = new Vector2(-chordVector.y, chordVector.x);
  const centerPoint =
		startPoint.clone()
		.add(chordVector.clone().multiplyScalar(chordLength/2))
		.add(sagittaVector.clone().multiplyScalar(arcHeight-radius));

  // compute number of interpolation points based on supplied input
  let numPoints = 0;
  if (maxSegmentLength) {
    numPoints = Math.max(numPoints, Math.ceil(Math.abs(radius * theta / maxSegmentLength)));
  }
  if (maxAngle) {
    numPoints = Math.max(numPoints, Math.ceil(Math.abs(theta) / maxAngle));
  }

  // total point count includes edge points (which are not returned)
  const totalNumPoints = numPoints + 1;
  const deltaTheta = theta / totalNumPoints;
  const offsetTheta = (-theta / 2) + deltaTheta;

  // create, return the interpolated points
  const resultPoints = [];
  for (let i=0; i < numPoints; i++) {
    const pointTheta = offsetTheta + (deltaTheta * i);
    resultPoints.push(
      centerPoint.clone()
      .add(sagittaVector.clone().multiplyScalar(radius * Math.cos(pointTheta)))
      .add(chordVector.clone().multiplyScalar(radius * Math.sin(pointTheta)))
    );
  }

  return resultPoints;
}

/**
 * Computes the length of a given chord given radius and angle -- used for
 * collision resolution on floorplans that have arc intersection errors
 */
function computeChordLengthFromRadiusAndAngle (radius, arcEndpointAngle) {
  return 2 * radius * Math.sin(Math.abs(arcEndpointAngle));
}

module.exports = {
  computeArcRadius,
  computeArcAngle,
  interpolateArcPointsByCount,
  interpolateArcPointsByConstraints,
  computeChordLengthFromRadiusAndAngle
};

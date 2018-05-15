"use strict";
const { Vector2 } = require("three");
const { interpolateArcPointsByConstraints } = require("./arcs");

// this is configurable
var ARC_INTERPOLATION_PRECISION = Math.PI / 32;

// internal helper for getting the area of a region based on boundary IDs
function _regionArea (boundaryIDs, idToBoundaryPoints) {

  // figure out if first boundary point array is flipped
  const firstPoints = idToBoundaryPoints[boundaryIDs[0]];
  const lastPoints = idToBoundaryPoints[boundaryIDs[boundaryIDs.length-1]];
  let prevPoint = firstPoints[0];
  if (!(
    prevPoint === lastPoints[0] ||
		prevPoint === lastPoints[lastPoints.length-1]
  )) {
    prevPoint = firstPoints[firstPoints.length-1];
  }

  let area = 0;
  for (let bi = 0; bi < boundaryIDs.length; bi++) {
    let points = idToBoundaryPoints[boundaryIDs[bi]];
    if (points[0] !== prevPoint) {
      points = points.slice();
      points.reverse();
    }
    for (let pi = 0; pi < points.length - 1; pi++) {
      const p0 = points[pi];
      const p1 = points[pi + 1];
      area += p0.x * p1.y;
      area -= p0.y * p1.x;
    }
    prevPoint = points[points.length-1];
  }

  area /= 2;
  return Math.abs(area);
}

/**
 * Sets the precision at which arcs will be interpolated during cycle nesting
 * computations, in radians. Smaller is more precise.
 * @param angle: precision of arc interpolation
 */
function setArcInterpolationPrecision (angle) {
  ARC_INTERPOLATION_PRECISION = angle;
}

/**
 * Resolves the area of a given V4 room (with scale applied)
 *
 * NOTE THAT THIS DOES NOT TAKE UNITS INTO ACCOUNT! Divide by 12^2 for sqft,
 * since our native coordinates are in inches, and 10^2 for metric floors.
 *
 * @property floor: a V4 floor
 * @property regionIDs: optional subset of region IDs
 */
function getArea (floor, regionIDs) {

  // map points to three.js points
  const srcPoints = floor.data.points;
  const idToPoint = {};
  for (let pi=0; pi < srcPoints.length; pi++) {
    const point = srcPoints[pi];
    idToPoint[point.id] = new Vector2(point.x, point.y);
  }

  // map boundaries to vertex arrays
  const srcBoundaries = floor.data.boundaries;
  const idToBoundaryPoints = {};
  for (let bi = 0; bi < srcBoundaries.length; bi++) {
    const boundary = srcBoundaries[bi];
    const startPoint = idToPoint[boundary.start];
    const endPoint = idToPoint[boundary.end];
    const points = [startPoint];
    if (boundary.arc) {
      points.push(...interpolateArcPointsByConstraints(
        startPoint,
        endPoint,
        boundary.arc,
        0,
        ARC_INTERPOLATION_PRECISION
      ));
    }
    points.push(endPoint);
    idToBoundaryPoints[boundary.id] = points;
  }

  // downfilter selected rooms from all to a subset if requested
  let selectedRooms = floor.data.rooms;
  if (regionIDs) {
    const regionIDSet = {};
    for (let ri = 0; ri < regionIDs.length; ri++) {
      regionIDSet[regionIDs[ri]] = 1;
    }
    selectedRooms = selectedRooms.filter(r => regionIDSet[r.id]);
  }

  // get to work!
  let totalArea = 0;
  for (let ri = 0; ri < selectedRooms.length; ri++) {
    const room = selectedRooms[ri];
    const {
      perimeter,
      holes
    } = room.boundaries;
    totalArea += _regionArea(perimeter, idToBoundaryPoints);
    if (holes && holes.length) {
      for (let hi=0; hi<holes.length; hi++) {
        totalArea -= _regionArea(holes[hi], idToBoundaryPoints);
      }
    }
  }

  // apply floor scale, units
  const scale = (floor.data.scale || 1);
  return totalArea * scale * scale;
}

module.exports = {
  getArea,
  setArcInterpolationPrecision
};

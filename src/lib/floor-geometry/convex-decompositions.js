"use strict";
const debug = require("debug")("openfpc:floor-geometry:convex-decomposition");
const convexHull = require("monotone-convex-hull-2d");
const decomp = require("poly-decomp");
const earcut = require("earcut");
const polybool = require("polybooljs");

/**
 * Decomposes a concave polygon into component convex polygons.
 * @param srcPolygon: array of points as 2D coordinates arrays
 * @returns: an array of arrays of points as 2D coordinate arrays
 */
function decomposeToConvexParts(srcPolygon) {
  return decomp.quickDecomp(srcPolygon);
}

/**
 * Decomposes an concave polygon into an outer hull and a list of convex
 * obstacles projecting inwards.
 * @param srcPolygon: an array of points as 2D coordinate arrays
 * @returns: an object with the following parameters:
 *   - outerHull: a convex array-array polygon
 *   - obstacles: an array of convex array-array polygons
 */
function decomposeToConvexHullAndObstacles(srcPolygon) {

  // get outer convex
  const outerHullOrdering = convexHull(srcPolygon);
  const outerHull = outerHullOrdering.map(i => srcPolygon[i]);
  decomp.makeCCW(outerHull);

  const outerHullPB = {
    regions: [outerHull],
    inverted: false
  };
  const srcPolygonPB = {
    regions: [srcPolygon],
    inverted: false
  };

  // subtract source from outer convex
  let obstaclesPB;
  try {
    obstaclesPB = polybool.difference(outerHullPB, srcPolygonPB);
  }
  catch (err) {
    debug("error subtracting cycle perimeter from convex hull", {
      epsilon: polybool.epsilon()
    });
    throw err;
  }

  // decompose the subtracted bits into convex polygons
  const convexObstacles = [];
  obstaclesPB.regions.forEach(region => {

    // use polygon-decomp lib if possible
    if (decomp.isSimple(region)) {
      try {
        decomp.makeCCW(region);
        decomp.quickDecomp(region).forEach(convexRegion => {
          convexObstacles.push(convexRegion);
        });
        return;
      } catch (e) {
        // poly-decomp is great, but sometimes spotty - don't let it crash apps
        console.warn("poly-decomp threw an error", e); // eslint-disable-line no-console
      }
    }

    // otherwise, fall back to an earcut triangulation -- this yields
    // sub-optimal results because we get a lot of triangles, but it's
    // the only way to handle self-intersecting (shared-vertex) cases.
    const flattenedRegion = [];
    for (let i=0; i<region.length; i++) {
      const regionPoint = region[i];
      flattenedRegion.push(regionPoint[0], regionPoint[1]);
    }
    const triangleIndices = earcut(flattenedRegion, null, 2);
    for (let i=0; i<triangleIndices.length; i+=3) {
      const triangle = [
        region[triangleIndices[i]],
        region[triangleIndices[i+1]],
        region[triangleIndices[i+2]]
      ];
      convexObstacles.push(triangle);
    }
  });

  // return the results
  return {
    outerHull: outerHull,
    obstacles: convexObstacles
  };
}

// Configure polybool to use a larger-than-default epsilon, as otherwise we
// hit some nasty zero-length segment issues. Our polygon coordinates are a
// few orders of magnitude larger than what polybool's defaults can handle.
polybool.epsilon(0.0000001);

module.exports = {
  makeCCW: decomp.makeCCW,
  decomposeToConvexParts,
  decomposeToConvexHullAndObstacles
};

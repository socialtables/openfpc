/* eslint-disable no-use-before-define */
const SAT = require("sat");
const QuadTree = require("simple-quadtree");
const decomp = require("./convex-decompositions");

// internal containment and collision check flags
const NO_COLLISION = 0;
const CONTAINED_BY_OTHER = -1;
const CONTAINS_OTHER = 1;
const COLLISION = 2;

// internal enclosure tree node representation
class _EnclosureNode {
  /**
	 * @constructor
	 * @param srcPolygon: the source polygon in array-array notation
	 * @param srcID: the source ID used to report collisions
	 * @param cached: cached deconstruction data for this polygon
	 */
  constructor (srcPolygon, srcID, cached) {

    // id will be set by EnclosureTree, is used exclusively for broad
    // phase collision association
    this.id = null;
    this.srcID = (srcID === undefined) ? null : srcID;

    // isObstacle is also set by enclosure tree after the final structure
    // is known -- necessary for boolean intersection rings in FPA
    this.isObstacle = false;

    if (!cached) {
      // perform convex decompositions
      const ccwSrcPolygon = srcPolygon.slice(); // might get reversed
      decomp.makeCCW(ccwSrcPolygon);
      const dec = decomp.decomposeToConvexHullAndObstacles(ccwSrcPolygon);
      const decConvexParts = decomp.decomposeToConvexParts(ccwSrcPolygon);

      // store decompositions in SAT format for collision checking
      this.innerConvexes = decConvexParts.map(_arrayPolygonToSAT);
      this.outerConvex = _arrayPolygonToSAT(dec.outerHull);
      this.outerConvexObstacles = dec.obstacles.map(_arrayPolygonToSAT);

      // retain source polygon for debugging
      // TODO: make this behavior optional to save memory
      this.srcPolygon = srcPolygon;
    }
    else {
      // if cached, use cached decompositions
      this.innerConvexes = cached.ic.map(_arrayPolygonToSAT);
      this.outerConvex = _arrayPolygonToSAT(cached.oc);
      this.outerConvexObstacles = cached.oco.map(_arrayPolygonToSAT);
      this.isObstacle = cached.o || false;
      this.srcPolygon = cached.src || null;
    }

    // node relationships are inexpensive to compute, not cached
    this.interiorNodes = [];
    this.exteriorNode = null;
  }
  toCache () {
    return {
      srcID: this.srcID || undefined,
      src: this.srcPolygon,
      ic: this.innerConvexes.map(_satToArrayPolygon),
      oc: _satToArrayPolygon(this.outerConvex),
      oco: this.outerConvexObstacles.map(_satToArrayPolygon),
      o: this.isObstacle || undefined
    };
  }
  checkNodeContainment (that, broadPhaseHits) {

    // run initial polygon collision
    const satResp = new SAT.Response();
    const outerConvexCollided = SAT.testPolygonPolygon(this.outerConvex, that.outerConvex, satResp);

    // no collision, no problem
    if (!outerConvexCollided) {
      return NO_COLLISION;
    }

    // do not register partial collisions, as they do not effect enclosure
    if (!(satResp.aInB || satResp.bInA)) {
      return NO_COLLISION;
    }

    // if this convex hull is inside the other convex hull, we can compare
    // all points in this against the other's exterior projections. if any
    // contain points from this, we know we do not have full encapsulation.
    if (satResp.aInB) {
      for (let a=0; a<this.innerConvexes.length; a++) {
        for (let b=0; b<that.outerConvexObstacles.length; b++) {
          const thisPolygon = this.innerConvexes[a];
          const thatPolygon = that.outerConvexObstacles[b];
          if (!broadPhaseHits[thisPolygon.id]) {
            continue;
          }
          if (SAT.testPolygonPolygon(thisPolygon, thatPolygon)) {
            return NO_COLLISION;
          }
        }
      }
      return CONTAINED_BY_OTHER;
    }

    // the converse is also true
    else if (satResp.bInA) {
      for (let a=0; a<this.outerConvexObstacles.length; a++) {
        for (let b=0; b<that.innerConvexes.length; b++) {
          const thisPolygon = this.outerConvexObstacles[a];
          const thatPolygon = that.innerConvexes[b];
          if (!broadPhaseHits[thisPolygon.id]) {
            continue;
          }
          if (SAT.testPolygonPolygon(thisPolygon, thatPolygon)) {
            return NO_COLLISION;
          }
        }
      }
      return CONTAINS_OTHER;
    }
  }
  checkPolygonContainment (poly, broadPhaseHits) {
    const satResp = new SAT.Response();
    const outerCollision = SAT.testPolygonPolygon(this.outerConvex, poly, satResp);
    if (!outerCollision || !satResp.bInA) {
      return NO_COLLISION;
    }
    if (satResp.aInB) {
      return CONTAINED_BY_OTHER;
    }
    for (let i=0; i<this.outerConvexObstacles.length; i++) {
      const obstacle = this.outerConvexObstacles[i];
      if (!broadPhaseHits[obstacle.id]) {
        continue;
      }
      if (SAT.testPolygonPolygon(obstacle, poly)) {
        return NO_COLLISION;
      }
    }
    return CONTAINS_OTHER;
  }
  checkPolygonCollision (poly, broadPhaseHits) {
    for (let i=0; i<this.innerConvexes.length; i++) {
      const obstacle = this.innerConvexes[i];
      if (!broadPhaseHits[obstacle.id]) {
        continue;
      }
      if (SAT.testPolygonPolygon(poly, obstacle)) {
        return COLLISION;
      }
    }
    return NO_COLLISION;
  }
  checkCircleContainment (circle, broadPhaseHits) {
    const satResp = new SAT.Response();
    const outerCollision = SAT.testPolygonCircle(this.outerConvex, circle, satResp);
    if (!outerCollision || !satResp.bInA) {
      return NO_COLLISION;
    }
    if (satResp.aInB) {
      return CONTAINED_BY_OTHER;
    }
    for (let i=0; i<this.outerConvexObstacles.length; i++) {
      const obstacle = this.outerConvexObstacles[i];
      if (!broadPhaseHits[obstacle.id]) {
        continue;
      }
      if (SAT.testPolygonCircle(obstacle, circle)) {
        return NO_COLLISION;
      }
    }
    return CONTAINS_OTHER;
  }
  checkCircleCollision (circle, broadPhaseHits) {
    for (let i=0; i<this.innerConvexes.length; i++) {
      const obstacle = this.innerConvexes[i];
      if (!broadPhaseHits[obstacle.id]) {
        continue;
      }
      if (SAT.testCirclePolygon(circle, obstacle)) {
        return COLLISION;
      }
    }
    return NO_COLLISION;
  }
  checkPointCollision (point, broadPhaseHits) {
    for (let i=0; i<this.innerConvexes.length; i++) {
      if (!broadPhaseHits[this.innerConvexes[i].id]) {
        continue;
      }
      if (SAT.pointInPolygon(point, this.innerConvexes[i])) {
        return COLLISION;
      }
    }
    return NO_COLLISION;
  }
  checkGenericSATContainment (satEntity, broadPhaseHits) {
    switch (satEntity.constructor) {
    case SAT.Polygon:
      return this.checkPolygonContainment(satEntity, broadPhaseHits);
    case SAT.Circle:
      return this.checkCircleContainment(satEntity, broadPhaseHits);
    case SAT.Vector:
      return (this.checkPointCollision(satEntity, broadPhaseHits) === COLLISION)
        ? (CONTAINS_OTHER)
        : NO_COLLISION;
    default:
      throw new Error("invalid entity for check");
    }
  }
  checkGenericSATCollision (satEntity, broadPhaseHits) {
    switch (satEntity.constructor) {
    case SAT.Polygon:
      return this.checkPolygonCollision(satEntity, broadPhaseHits);
    case SAT.Circle:
      return this.checkCircleCollision(satEntity, broadPhaseHits);
    case SAT.Vector:
      return this.checkPointCollision(satEntity, broadPhaseHits);
    default:
      throw new Error("invalid entity for check");
    }
  }
}

/**
 * Enclosure tree for collision checking and hierarchy formation.
 * Allows us to efficiently check for full enclosure of rooms and boundaries
 * inside other rooms and retrieve their IDs.
 */
class EnclosureTree {
  /**
	 * @constructor
	 * @param bbox: outermost bounding box of this tree
	 */
  constructor (bbox, _cached) {
    this.roots = [];
    this.quadtree = new QuadTree(bbox.min.x, bbox.min.y, bbox.max.x-bbox.min.x, bbox.max.y-bbox.min.y, { maxchildren: 8 });
    this._nextID = 0;

    // retain bbox for use in cache later
    this._bbox = bbox;

    // apply cache if available
    if (_cached) {
      _cached.nodes.forEach(cn => {
        this.addPolygon(cn.oc, cn.srcID, cn);
      });
    }
  }

  /**
	 * Dumps the tree into a serializable data structure for caching
	 * @return: a compact javascript object representation of this tree
	 */
  toCache () {
    const cachedNodes = [];
    let frontier = this.roots.slice();
    while (frontier.length > 0) {
      const nextNode = frontier.pop();
      const cachedNode = nextNode.toCache();
      cachedNodes.push(cachedNode);
      if (nextNode.interiorNodes) {
        frontier = frontier.concat(nextNode.interiorNodes);
      }
    }
    return {
      nodes: cachedNodes,
      bbox: [this._bbox.min.x, this._bbox.min.y, this._bbox.max.x, this._bbox.max.y],
      v: 2.1
    };
  }

  /**
	 * Reconstructs a tree from the provided compact representation
	 * @return: an EnclosureTree corrisponding to the provided data
	 */
  static fromCache (cached) {
    if (cached.v !== 2.1) {
      throw new Error("EnclosureTree version mismatch; rejecting cached tree");
    }
    const _bboxFromCache = cBox => ({min:{x:cBox[0],y:cBox[1]},max:{x:cBox[2],y:cBox[3]}});
    return new EnclosureTree(_bboxFromCache(cached.bbox), cached);
  }

  /**
	 * Adds a polygon to the tree
	 * @param srcPolygon: the source polygon, in array-array format
	 * @param id: the polygon's ID for collision lookup
	 * @return: this
	 */
  addPolygon(srcPolygon, id, _cached) {

    // create node
    const newNode = new _EnclosureNode(srcPolygon, id, _cached || null);

    // store ID and bbox on the node itself
    const bbox = _getArrPolygonBounds(srcPolygon);
    newNode.id = bbox.id = this._nextID++;

    // check quadtree for intersections (broad-phase collision check)
    const hits = {};
    this.quadtree.get(bbox).forEach(hit => {
      hits[hit.id] = 1;
    });

    // add the polygon to the polygon tree
    this.roots = this._addPolygonToLayer(this.roots, newNode, hits);

    // add the polygon to the quadtree
    this.quadtree.put(bbox);

    // label and add the polygon's internal polygons to the quadtree
    newNode.innerConvexes.concat(newNode.outerConvexObstacles).forEach(polygon => {
      const polygonBounds = _getSATPolygonBounds(polygon);
      polygon.id = polygonBounds.id = this._nextID++;
      this.quadtree.put(polygonBounds);
    });

    // allow chaining
    return this;
  }

  // internal method for adding a polygon to a layer of nodes
  _addPolygonToLayer(nodeLayer, newNode, broadPhaseHits) {
    const containedLayerNodes = [];
    for (let i=0; i<nodeLayer.length; i++) {
      const extantNode = nodeLayer[i];
      if (!broadPhaseHits[extantNode.id]) {
        continue;
      }
      const containmentComp = extantNode.checkNodeContainment(newNode, broadPhaseHits);
      if (containmentComp === NO_COLLISION) {
        continue;
      }
      else {
        // extant node contains the new one, so recurse into it
        if (containmentComp === CONTAINS_OTHER) {
          extantNode.interiorNodes = this._addPolygonToLayer(extantNode.interiorNodes, newNode, broadPhaseHits);
          return nodeLayer;
        }
        // this should only ever happend at the root level
        if (containmentComp === CONTAINED_BY_OTHER) {
          containedLayerNodes.push(extantNode);
        }
      }
    }

    // if uncontained, add new node to the layer
    nodeLayer.push(newNode);

    // if the new node contains part of the layer, we need to remove the
    // contained nodes from the current layer and add them to the new node
    if (containedLayerNodes.length > 0) {
      newNode.interiorNodes = containedLayerNodes;
      return nodeLayer.filter(node => (containedLayerNodes.indexOf(node) === -1));
    }

    // no containment, so add to current layer
    return nodeLayer;
  }
  /**
	 * Traverses this enclosure tree, calling the specified callback for each
	 * node and recursing into child nodes. Used to identify structure during
	 * room resolution and mark obstacle layers for layout automation.
	 * @param cb: a function which accepts:
	 *            - the node's source ID
	 *            - the parent node's source ID
	 *            - the depth of the node
	 *            - a function to set the node as an obstacle or change its ID
	 * @return this
	 */
  traverseDown (cb) {
    const _traverseNode = (node, parent, depth) => {
      cb(
        node.srcID,
        parent ? parent.srcID : null,
        depth,
        (obs, updateID) => {
          if (obs === false ||
						obs === true) {
            node.isObstacle = obs;
          }
          if (updateID) {
            node.srcID = updateID;
          }
        }
      );
      node.interiorNodes.forEach(intNode => _traverseNode(intNode, node, depth+1));
    };
    this.roots.forEach(rootNode => _traverseNode(rootNode, null, 0));
    return this;
  }
  // internal recursor for getting the node that contains a given SAT entity
  _getEnclosingOrObstacleNode (layer, satEntity, broadPhaseHits) {
    for (let i=0; i < layer.length; i++) {
      const layerNode = layer[i];
      if (!broadPhaseHits[layerNode.id]){
        continue;
      }
      if (layerNode.isObstacle) {
        if (layerNode.checkGenericSATCollision(satEntity, broadPhaseHits) === COLLISION) {
          return this._getEnclosingOrObstacleNode(layerNode.interiorNodes, satEntity, broadPhaseHits) || layerNode;
        }
      }
      else {
        if (layerNode.checkGenericSATContainment(satEntity, broadPhaseHits) === CONTAINS_OTHER) {
          return this._getEnclosingOrObstacleNode(layerNode.interiorNodes, satEntity, broadPhaseHits) || layerNode;
        }
      }
    }
    return null;
  }
  /**
	 * Gets the source ID of the innermost enclosing polygon, ignoring the
	 * specified source ID (to avoid self-enclosure confusion). Returns null
	 * if no enclosing polygon was found.
	 * @param srcPoint: the point to check in { x: , y: } notation
	 * @returns the innermost enclosing polygon's ID
	 */
  getEnclosingPolygonIDForPoint (srcPoint) {
    const x = srcPoint.x;
    const y = srcPoint.y;
    const satPoint = new SAT.Vector(x, y);
    const bbox = { x, y, w: 0, h: 0 };
    const broadPhaseHits = {};
    this.quadtree.get(bbox).forEach(hit => broadPhaseHits[hit.id] = 1);
    const enclosingNode = this._getEnclosingOrObstacleNode(this.roots, satPoint, broadPhaseHits);
    if (enclosingNode && !enclosingNode.isObstacle) {
      return enclosingNode.srcID;
    }
    return null;
  }
  /**
	 * Works like getEnclosingPolygonIDForPoint, but responds with a boolean
	 * @param srcPoint: the point to check in array notation
	 * @returns: true or false
	 */
  checkPointEnclosed (srcPoint) {
    const x = srcPoint[0];
    const y = srcPoint[1];
    const satPoint = new SAT.Vector(x, y);
    const bbox = { x, y, w: 0, h: 0 };
    const broadPhaseHits = {};
    this.quadtree.get(bbox).forEach(hit => broadPhaseHits[hit.id] = 1);
    const enclosingNode = this._getEnclosingOrObstacleNode(this.roots, satPoint, broadPhaseHits);
    if (enclosingNode && !enclosingNode.isObstacle) {
      return true;
    }
    return false;
  }
  /**
	 * Checks whether a given polygon (in array-array format) is fully
	 * enclosed. This is pretty much the core of layout automation.
	 * @param srcArrPolygon: a polygon in array-array notation
	 * @returns: true or false
	 */
  checkPolygonEnclosed (srcArrPolygon) {
    const satPoly = _arrayPolygonToSAT(srcArrPolygon);
    const bbox = _getArrPolygonBounds(srcArrPolygon);
    const broadPhaseHits = {};
    this.quadtree.get(bbox).forEach(hit => broadPhaseHits[hit.id] = 1);
    const enclosingNode = this._getEnclosingOrObstacleNode(this.roots, satPoly, broadPhaseHits);
    if (enclosingNode && !enclosingNode.isObstacle) {
      return true;
    }
    return false;
  }
  /**
	 * Checks whether a given circle (with an origin in array notation) is
	 * enclosed.
	 * @param srcPoint: a point in array notation
	 * @param srcRadius: radius of the circle to check
	 * @returns: true or false
	 */
  checkCircleEnclosed (srcPoint, srcRadius) {
    const satCircle = new SAT.Circle(new SAT.Vector(srcPoint[0], srcPoint[1]), srcRadius);
    const bbox = {
      x: srcPoint[0] - srcRadius,
      y: srcPoint[1] - srcRadius,
      w: srcRadius * 2,
      h: srcRadius * 2
    };
    const broadPhaseHits = {};
    this.quadtree.get(bbox).forEach(hit => broadPhaseHits[hit.id] = 1);
    const enclosingNode = this._getEnclosingOrObstacleNode(this.roots, satCircle, broadPhaseHits);
    if (enclosingNode && !enclosingNode.isObstacle) {
      return true;
    }
    return false;
  }

  /**
	 * Gets the outer bounding box of this enclosure tree, as-initialized;
	 * will generally be a three.Box2 if tree was created by room-traversal.
	 * @returns: the bounding box provided to the constructor
	 */
  getBBox () {
    return this._bbox;
  }
}

// internal SAT polygon conversion helper
function _arrayPolygonToSAT(srcPolygon) {
  return new SAT.Polygon(new SAT.Vector(), srcPolygon.map(pt => new SAT.Vector(pt[0], pt[1])));
}

// internal reverse SAT polygon conversion helper
function _satToArrayPolygon(srcSAT) {
  return srcSAT.points.map(pt => [pt.x, pt.y]);
}

// internal quadtree bbox boundary conversion for SAT polygons
function _getSATPolygonBounds(srcPolygon) {
  let p = srcPolygon.points[0];
  let xMin, xMax, yMin, yMax;
  xMin = xMax = p.x;
  yMin = yMax = p.y;
  for (let i=1; i<srcPolygon.points.length; i++) {
    p = srcPolygon.points[i];
    if (xMin > p.x) {
      xMin = p.x;
    }
    if (xMax < p.x) {
      xMax = p.x;
    }
    if (yMin > p.y) {
      yMin = p.y;
    }
    if (yMax < p.y) {
      yMax = p.y;
    }
  }
  return {
    x: xMin,
    y: yMin,
    w: xMax - xMin,
    h: yMax - yMin,
    id: null // filled in later, initialized for shape
  };
}

// internal quadtree bbox conversion for coordinate array polygons
function _getArrPolygonBounds(srcPolygon) {
  let p = srcPolygon[0];
  let xMin, xMax, yMin, yMax;
  xMin = xMax = p[0];
  yMin = yMax = p[1];
  for (let i=1; i<srcPolygon.length; i++) {
    p = srcPolygon[i];
    if (xMin > p[0]) {
      xMin = p[0];
    }
    if (xMax < p[0]) {
      xMax = p[0];
    }
    if (yMin > p[1]) {
      yMin = p[1];
    }
    if (yMax < p[1]) {
      yMax = p[1];
    }
  }
  return {
    x: xMin,
    y: yMin,
    w: xMax - xMin,
    h: yMax - yMin,
    id: null // filled in later, initialized for shape
  };
}

module.exports = EnclosureTree;

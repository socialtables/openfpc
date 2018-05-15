import { Vector2 } from "three";

////////////////////////////
//////// raw shapes ////////
////////////////////////////

const _origin2 = new Vector2(0, 0);

function _door (doorAngle = 90) {
  const numArcPoints = 10;
  const points = [];
  const angleCoeff = (Math.PI * doorAngle) / (180 * (numArcPoints - 1));
  for (let i = 0; i < numArcPoints; i++) {
    points.push(new Vector2(
      Math.cos(i * angleCoeff) - 0.5,
      Math.sin(i * angleCoeff)
    ));
  }
  points.push(new Vector2(-0.5, 0));
  return points;
}

function _doubleDoor (doorAngle = 90) {
  const leftDoorPoints = _door(doorAngle);
  const rightDoorPoints = _door(doorAngle);
  leftDoorPoints.reverse();
  leftDoorPoints.forEach(p => p.x -= 0.5);
  rightDoorPoints.forEach(p => p.x = 0.5 - p.x);
  return [leftDoorPoints, rightDoorPoints];
}

function _rect () {
  // close shape manually
  return [
    new Vector2(-1, -1),
    new Vector2(1, -1),
    new Vector2(1, 1),
    new Vector2(-1, 1),
    new Vector2(-1, -1)
  ];
}

function _circle () {
  const points = [];
  const numArcPoints = 16;
  // close shape manually
  for (let i = 0; i <= numArcPoints; i++) {
    points.push(new Vector2(
      Math.cos(i * Math.PI / 8),
      Math.sin(i * Math.PI / 8),
    ));
  }
  return points;
}

/*function _chair () {
    const numArcPoints = 8;
    const points = [];
    points.push(1, -1);
    for (let i = 0; i < numArcPoints; i++) {
        points.push(new Vector2(
            Math.cos(i * Math.PI / (numArcPoints - 1)),
            Math.sin(i * Math.PI / (numArcPoints - 1))
        ));
    }
    points.push(-1, -1);
    return points;
}*/

///////////////////////////////
//////// object shapes ////////
///////////////////////////////

function doorVerts (obj) {
  const {
    x,
    y,
    width = 24,
    rotation = 0,
    isFlippedX = false
  } = obj;
  const offset = new Vector2(x, y);
  const scale = new Vector2(width * (isFlippedX ? 1 : -1), width);
  return _door().map(p2 => p2
  .multiply(scale)
  .rotateAround(_origin2, rotation * Math.PI / 180)
  .add(offset)
  );
}

function doubleDoorVerts (obj) {
  const {
    x,
    y,
    width = 12,
    rotation = 0,
    isFlippedX = false
  } = obj;
  const offset = new Vector2(x, y);
  const scale = new Vector2(width * (isFlippedX ? 1 : -1), width);
  return _doubleDoor().map(d => d.map(p2 => p2
  .multiply(scale)
  .rotateAround(_origin2, rotation * Math.PI / 180)
  .add(offset)
  ));
}

function columnVerts (obj) {
  const {
    x,
    y,
    width = 12,
    height = 12,
    rotation = 0
  } = obj;
  const offset = new Vector2(x, y);
  const scale = new Vector2(width / 2, height / 2);
  return _rect().map(p2 => p2
  .multiply(scale)
  .rotateAround(_origin2, rotation * Math.PI / 180)
  .add(offset)
  );
}

function circularColumnVerts (obj) {
  const {
    x,
    y,
    width
  } = obj;
  const offset = new Vector2(x, y);
  const scale = new Vector2(width / 2, width / 2);
  return _circle().map(p2 => p2
  .multiply(scale)
  .add(offset)
  );
}

function outletVerts (obj) {
  const {
    x,
    y,
    width = 12
  } = obj;
  const offset = new Vector2(x, y);
  const scale = new Vector2(width / 2, width / 2);
  return [
    _circle(),
    [new Vector2(0, 0.25), new Vector2(0.8, 0.25)],
    [new Vector2(0, -0.25), new Vector2(0.8, -0.25)]
  ]
  .map(l => l.map(p2 => p2
  .multiply(scale)
  .add(offset)
  ));
}

function windowVerts (obj) {
  const {
    x,
    y,
    width = 12,
    rotation = 0
  } = obj;
  const offset = new Vector2(x, y);
  const scale = new Vector2(width / 2, width / 2);
  return [
    [
      new Vector2(1, 0),
      new Vector2(-1, 0)
    ]
    .map(p2 => p2
    .multiply(scale)
    .rotateAround(_origin2, rotation * Math.PI / 180)
    .add(offset)
    )
  ];
}

function riggingVerts (obj) {
  const {
    x,
    y,
    width = 12
  } = obj;
  const offset = new Vector2(x, y);
  const scale = new Vector2(width / 2, width / 2);
  return [
    _circle(),
    [new Vector2(-1, 0), new Vector2(1, 0)],
    [new Vector2(0, 1), new Vector2(0, -1)]
  ]
  .map(l => l.map(p2 => p2
  .multiply(scale)
  .add(offset)
  ));
}

export function getObjectVertices (obj) {
  const { objectType } = obj;
  switch (objectType) {
  case "door":
    return [doorVerts(obj)];
  case "double-door":
    return doubleDoorVerts(obj);
  case "round-column":
    return [circularColumnVerts(obj)];
  case "column":
    return [columnVerts(obj)];
  case "electric-outlet":
    return outletVerts(obj);
  case "window":
    return windowVerts(obj);
  case "rigging":
    return riggingVerts(obj);
  default:
    return [circularColumnVerts(obj)];
  }
}

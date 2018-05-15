/**
 * Box-select overlay component
 * @param {Object} props - React props
 * @param {THREE.Box2} props.bbox2 - Three.JS bbox2 to render (viewport coords)
 */
export default function SelectBoxOverlay ({ bbox2 }) {
  if (!bbox2) {
    return null;
  }
  const boxStyle = {
    visibility: "visible",
    left: bbox2.min.x,
    top: bbox2.min.y,
    width: bbox2.max.x - bbox2.min.x,
    height: bbox2.max.y - bbox2.min.y
  };
  return <div className="selection-box-overlay" style={boxStyle}></div>;
}

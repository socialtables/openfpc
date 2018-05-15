// helper to draw transform bounding boxes
export default function BBoxOverlay (props) {
  const { bbox } = props;
  if (!bbox) {
    return;
  }
  return <div className="transform-box-overlay" style={{
    left: bbox.min.x,
    top: bbox.min.y,
    width: bbox.max.x - bbox.min.x,
    height: bbox.max.y - bbox.min.y
  }}>
    <span className="corner corner-1"/>
    <span className="corner corner-2"/>
    <span className="corner corner-3"/>
    <span className="corner corner-4"/>
  </div>;
}

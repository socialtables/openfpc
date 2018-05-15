// helper for rendering the select boundary hint for the rotate tool
export default function SelectBoxOverlay ({ text, cursorPositon }) {
  if (!cursorPositon || !text) {
    return null;
  }
  const style = {
    left: cursorPositon.x + 12,
    top: cursorPositon.y + 12
  };
  return <div className="cursor-hint-overlay" style={style}>
    {text}
  </div>;

}

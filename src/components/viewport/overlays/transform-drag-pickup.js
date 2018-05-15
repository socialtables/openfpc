// helper for managing invisible drag regions
export default function TransformDragPickup (props) {
  return <div
    {...props}
    style={{
      display: "block",
      position: "absolute",
      zIndex: 11,
      width: 32,
      height: 32,
      // offset to center handle on parent-injected position
      marginLeft: -16,
      marginTop: -16,
      ...(props.style || {})
    }}
  >{ props.children }</div>;
}

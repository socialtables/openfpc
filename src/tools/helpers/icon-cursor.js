import { ScaleArrow } from "../../components/icons";

/**
 * Quick-and-dirty JS-based cursor display
 * @param {Object} props - react props
 * @param {number} props.x - x coordinate of cursor
 * @param {number} props.y - y coordinate of cursor
 * @param {number} props.iconWidth - width of icon
 * @param {number} props.iconHeight - height of icon
 * @param {number} props.iconRotation - rotation of icon
 * @param {React.Component} props.Icon - icon component to render
 */
export default function IconCursor ({
  x = 0,
  y = 0,
  iconWidth = 16,
  iconHeight = 16,
  iconRotation = 0,
  Icon = ScaleArrow
}) {
  return (
    <span style={{ // offset the by cursor position, midpoint correction
      position: "absolute",
      cursor: "none",
      zIndex: 10,
      left: x - (iconWidth / 2),
      top: y - (iconHeight / 2)
    }}>
      <Icon rotation={iconRotation}/>
    </span>
  );
}

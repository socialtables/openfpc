import "./button.less";

export default function Button({
  text = "",
  onClick = () => {},
  preventDefault = false,
  style = {},
  disabled = false
}){
  const onClickHandler = (e) => {
    if (preventDefault) {
      e.preventDefault();
    }
    onClick(e);
  };
  return <button
    onClick={onClickHandler}
    style={style}
    disabled={disabled}
  >
    { text }
  </button>;
}

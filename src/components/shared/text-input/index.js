import classnames from "classnames";
import AutosizeInput from "react-input-autosize";

import DebounceInput from "../debounce-input";
import "./text-input.less";

function translate(val){
  return val;
}

export default function TextInput({
  value,
  defaultValue,
  placeholder,
  className,
  autoFocus = false,
  disabled = false,
  isViewable = true,
  debounceInput = false,
  readOnly = false,
  debounceTime = 200,
  style = {},
  onChange = () => { },
  onKeyDown = () => { },
  onFocus = () => { },
  onBlur = () => { },
  onClick = () => { },
  refCallback = () => { },
  shouldUpdate = false,
  resetUpdate = () => { }
}) {

  const textClass = classnames("text-input", {
    [className]: !!className,
    "is-disabled": disabled && !isViewable
  });

  const inputDOM = (
    <input
      ref={ refCallback }
      className={ textClass }
      defaultValue={ defaultValue }
      value={ value }
      readOnly={ readOnly }
      disabled={ disabled }
      autoFocus={ autoFocus }
      placeholder={ translate(placeholder) }
      onChange={ onChange }
      onKeyDown={ onKeyDown }
      onFocus={ onFocus }
      onBlur={ onBlur }
      onClick={ onClick }
      style={ style }
    />
  );

  const autoInputDOM = (
    <AutosizeInput
      ref={ refCallback }
      className={ textClass }
      defaultValue={ defaultValue }
      value={ value }
      readOnly={ readOnly }
      disabled={ disabled }
      placeholder={ translate(placeholder) }
      onFocus={ onFocus }
      onKeyDown={ onKeyDown }
      onBlur={ onBlur }
      onChange={ onChange }
      onClick={ onClick }
      style={ style }
    />
  );


  if (debounceInput && className.indexOf("number-input__input") === -1 ) {
    return (
      <DebounceInput ms={debounceTime} shouldUpdate={shouldUpdate} resetUpdate={resetUpdate}>
        {inputDOM}
      </DebounceInput>
    );
  }
  else if (debounceInput){
    return (
      <DebounceInput ms={debounceTime} shouldUpdate={shouldUpdate} resetUpdate={resetUpdate}>
        {autoInputDOM}
      </DebounceInput>
    );
  }

  return inputDOM;
}
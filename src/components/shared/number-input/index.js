import { Component } from "react";
import { debounce } from "lodash";
import classnames from "classnames";
import TextInput from "../text-input";
import "./number-input.less";

// stub ST icon references
function Close_curved () { return <span className="svg-replacement">X</span>; }
function Wide_up_triangle () { return <span className="svg-replacement">V</span>; }

export default class NumberInput extends Component {
  constructor(props) {
    super(props);
    this.state = {
      inputValue: (this.props.value || this.props.value === 0) ? this.props.value : ""
    };
    this.debounceAddValue = props.debounceButton ? debounce(
      v => this.handleAddValue(v),
      props.debounceButtonTime
    ) : v => this.handleAddValue(v);
  }

  componentWillReceiveProps(nextProps) {
    if (nextProps.value !== this.state.inputValue) {
      this.setState({
        inputValue: nextProps.value
      });
    }
  }

  onFocus(event) {
    event.target.select();
  }

  handleAddValue(val) {
    if (!this.props.disabled) {
      let newValue;
      if (this.props.format) {
        newValue = this.props.format(this.state.inputValue) + val;
      }
      else {
        newValue = this.state.inputValue !== undefined && !isNaN(this.state.inputValue) ? parseFloat(this.state.inputValue) + val : 1;
      }
      this.setValue({ target: { value: newValue } }, newValue);
    }
  }

  handleOnChange(e) {
    if (this.props.usesDecimals) {
      if (!isNaN(parseFloat(e.target.value)) || e.target.value.length === 0 ) {
        this.setValue(e, parseFloat(e.target.value));
      }
    }
    else if (!isNaN(parseInt(e.target.value)) || e.target.value.length === 0 ) {
      this.setValue(e, parseFloat(e.target.value));
    }
  }

  handleKeyDown(e) {
    // up arrow
    if (e.keyCode === 38) {
      this.handleAddValue(1);
    }
    //down arrow
    else if (e.keyCode === 40) {
      this.handleAddValue(-1);
    }
  }

  setValue(e, value) {
    const max = !isNaN(parseInt(this.props.max)) ? this.props.max : Infinity;
    const min = !isNaN(parseInt(this.props.min)) ? this.props.min : -Infinity;
    const newValue = isNaN(value) ? "" : value;

    if (newValue === "" || (newValue <= max && newValue >= min)) {
      this.setState({ inputValue: value });
      this.props.onChange(e);
    }
  }

  render() {
    const className = this.props.className || "";
    const newValue = this.state.inputValue === 0 || this.state.inputValue ? this.state.inputValue : "";

    const numberInputContainerClass = classnames("number-input", {
      [this.props.className]: !!this.props.className,
      "is-disabled": this.props.disabled && !this.props.isViewable,
      "number-input--resettable": this.props.onReset,
      "has-no-buttons": this.props.hideButtons
    });

    const numberInputClass = classnames("number-input__input",{
      "number-input__spacing": this.props.isSpacing
    });

    let upTriangle, downTriangle;
    if (!this.props.hideButtons) {
      upTriangle = (
        <div
          onClick={ () => this.debounceAddValue(1) }
          className={ this.props.isCustomWidthLength || this.props.isCustomDiameter ? "number-input__top_custom-width-length number-input__top" : "number-input__top"}
        >
          <Wide_up_triangle />
        </div>
      );

      downTriangle = (
        <div
          onClick={ () => this.debounceAddValue(-1) }
          className={this.props.isCustomWidthLength || this.props.isCustomDiameter ? "number-input__bottom_custom-width-length number-input__bottom" : "number-input__bottom" }
        >
          <Wide_up_triangle />
        </div>
      );
    }

    const numberInput = (
      <div className={ numberInputContainerClass }>
        { upTriangle }
        <TextInput
          value={ newValue }
          className={ `${className} ${numberInputClass}` }
          defaultValue={ this.props.defaultValue }
          onChange={ e => this.handleOnChange(e) }
          onKeyDown={ e => this.handleKeyDown(e) }
          onFocus={ (e) => this.onFocus(e) }
          onBlur={ this.props.onBlur }
          disabled={ this.props.disabled }
          debounceInput={ this.props.debounceInput }
          debounceTime={ this.props.debounceInputTime }
          usesDecimals={ this.props.usesDecimals }
        />
        { downTriangle }
      </div>
    );

    if (this.props.onReset) {
      return (
        <div className="number-input__container" >
          { numberInput }
          <div className="number-input__reset-button"
            onClick={() => {
              if (!this.props.disabled) {
                this.props.onReset();
              }
            }}>
            <Close_curved/>
          </div>
        </div>
      );
    }
    return numberInput;
  }
}

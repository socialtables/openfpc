import { Component } from "react";
import classnames from "classnames";
import { debounce, throttle } from "lodash";

import TextInput from "../text-input";
import "./degrees-input.less";

function normalizeRotation(rotation){
  return (360 + rotation) % 360;
}

function formatFloat (num, precision=2) {
  return num ? +parseFloat(num).toFixed(precision) : num;
}

export default class DegreesInput extends Component {
  constructor(props) {
    super(props);
    const rotationValue = isNaN(props.value) ? 0 : normalizeRotation(props.value);
    this.state = {
      isActive: false,
      rotationValue: rotationValue
    };

    this.normalizeInputAndTriggerOnChange = debounce(this.normalizeInputAndTriggerOnChange, 450, {
      leading: false,
      trailing: true
    });
    this.handleAddValue = throttle(this.handleAddValue, 150);
  }

  componentWillReceiveProps(nextProps) {
    if (nextProps.value !== this.props.value) {
      const rotationValue = isNaN(nextProps.value) ? 0 : normalizeRotation(nextProps.value);
      this.setState({ rotationValue });
    }
  }

  handleChange(value) {
    this.setState({ rotationValue: value });
    this.normalizeInputAndTriggerOnChange(value);
  }

  normalizeInputAndTriggerOnChange(value) {
    let rotationValue = this.state.rotationValue;

    if (value === "") {
      rotationValue = value;
    }
    else if (value && value.length > 0) {
      const intValue = parseInt(value);
      const checkedRotationValue = intValue < 0 ? intValue - 360 : intValue;
      rotationValue = normalizeRotation(checkedRotationValue);
    }

    if (isNaN(rotationValue)) {
      rotationValue = 0;
    }

    this.props.onChange(rotationValue);
    this.setState({ rotationValue: rotationValue });
  }

  handleAddValue(val) {
    const rotationValue = this.state.rotationValue === "-" || this.state.rotationValue === "" ? 0 : this.state.rotationValue;
    const updatedRotation = parseInt(rotationValue) + val;

    this.setState({ rotationValue: rotationValue });
    this.props.onChange(updatedRotation);
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

  render() {
    const degreesInputClass = classnames({
      "degrees-input": true,
      "is-disabled": this.props.disabled,
      [this.props.className]: !!this.props.className
    });

    let degreeValue = "";
    if (this.props.value === "-" || this.props.value === "") {
      degreeValue = formatFloat(this.props.value);
    }
    else {
      const rotValue = formatFloat(this.state.rotationValue);
      degreeValue = this.state.isActive ? rotValue : `${rotValue}°`;
    }

    return (
      <div className={ degreesInputClass }>
        <TextInput
          { ...this.props }
          className="degrees-input__input"
          value={ degreeValue }
          onKeyDown={ e => this.handleKeyDown(e) }
          onChange={ e => this.handleChange(e.target.value) }
          onFocus={ () => this.setState({ isActive: true }) }
          onBlur={ () => this.setState({ isActive: false }) }
          disabled={ this.props.disabled }
        />
      </div>
    );
  }
}
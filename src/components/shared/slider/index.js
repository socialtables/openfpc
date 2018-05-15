import "./slider.less";
import React, { Component } from "react";


class Slider extends Component {

  constructor (props) {
    super(props);

    this.state = {
      active: false,
      limit: 0,
      grab: 0
    };

    this.onBeforeDrag = this.onBeforeDrag.bind(this);
    this.handleDrag = this.handleDrag.bind(this);
    this.onAfterDrag = this.onAfterDrag.bind(this);
  }

  _normalize(value, min, max){
    return Math.min(Math.max(value, min), max);
  }

  componentDidMount () {
    this.updateSliderPosition();
  }

  updateSliderPosition(){
    if (!this.slider) {
      return;
    }
    const sliderPos = this.slider.offsetWidth;
    const thumbPos = this.thumb.offsetWidth;

    this.setState({
      limit: sliderPos - thumbPos,
      grab: thumbPos / 2
    });
  }

  onBeforeDrag(){
    document.addEventListener("mousemove", this.handleDrag);
    document.addEventListener("mouseup", this.onAfterDrag);
    this.setState({ active: true });
  }

  handleDrag(e){
    e.stopPropagation();
    const { onChange } = this.props;
    if (!onChange){
      return;
    }

    let value = this.position(e);
    let ev = Object.assign({}, e, { target: { value }});
    onChange(ev);
  }

  onAfterDrag(){
    this.setState({ active: false });
    document.removeEventListener("mousemove", this.handleDrag);
    document.removeEventListener("mouseup", this.onAfterDrag);
  }

  /**
   * Calculate position of slider based on its value
   * @param  {number} value - Current value of slider
   * @return {position} pos - Calculated position of slider based on value
   */
  getPositionFromValue(value){
    const { limit } = this.state;
    const { min, max } = this.props;
    const diffMaxMin = max - min;
    const diffValMin = value - min;
    const percentage = diffValMin / diffMaxMin;
    const pos = Math.round(percentage * limit);
    return pos;
  }

  /**
   * Translate position of slider to slider value
   * @param  {number} pos - Current position of slider
   * @return {number} value - Slider value
   */
  getValueFromPosition(pos){
    const { limit } = this.state;
    const { min=0, max=100, step=1 } = this.props;
    const percentage = this._normalize(pos, 0, limit) / (limit || 1);
    const baseVal = step * Math.round(percentage * (max - min) / step);
    const value = baseVal + min;
    return this._normalize(value, min, max);
  }

  /**
   * Calculate position of slider based on value
   * @param  {Object} e - Event object
   * @return {number} value - Slider value
   */
  position(e){
    const { grab } = this.state;
    const direction = this.slider.getBoundingClientRect().left;
    const pos = e.clientX - direction - grab;
    return this.getValueFromPosition(pos);
  }

  /**
   * Get position of slider
   * @param  {Object} pos - Position object
   * @return {number} - Number of pixels to slider's left
   */
  getThumbPosition(pos){
    const { grab } = this.state;
    const value = this.getValueFromPosition(pos);
    const position = this.getPositionFromValue(value);
    return position + grab;
  }

  render () {
    const { value } = this.props;
    const position = this.getPositionFromValue(value);
    const thumbPos = this.getThumbPosition(position);
    const thumbStyle = { "left": `${thumbPos}px` };


    return (
      <div
        ref={s => {this.slider = s;}}
        value={value}
        className="slider"
        onMouseDown={this.handleDrag}
        onMouseUp={this.onAfterDrag}
      >
        <div className="slider__tick" />
        <div
          ref={el => {this.thumb = el;}}
          className='slider__thumb'
          onMouseDown={this.onBeforeDrag}
          style={thumbStyle}
        >
        </div>
      </div>
    );
  }
}

export default Slider;
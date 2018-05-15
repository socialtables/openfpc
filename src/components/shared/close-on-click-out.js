import React, { Component } from "react";

export default class CloseOnClickOut extends Component {
  constructor(props) {
    super(props);
    this.onClick = this.onClick.bind(this);
  }

  onClick(e) {
    if (!this.node.contains(e.target)) {
      this.props.onClickOut(e);
    }
  }

  componentDidMount() {
    document.addEventListener("mousedown", this.onClick);
  }

  componentWillUnmount() {
    document.removeEventListener("mousedown", this.onClick);
  }

  render() {
    const position = this.props.isUnits ? "absolute" : "relative";
    return <div
      style={{
        position: position,
        ...this.props.style
      }}
      ref={node => this.node = node}>
      {this.props.children}
    </div>;
  }
}

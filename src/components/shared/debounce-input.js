import { debounce } from "lodash";
import React from "react";
import filterInvalidDOMProps from "filter-invalid-dom-props";

export default class DebounceInput extends React.Component {
  constructor(props) {
    super(props);
    const { onChange, value } = React.Children.only(props.children).props;
    this.state = { value };
    this.debouncedOnChange = props.ms ? debounce(
      v => onChange(v),
      props.ms
    ) : v => onChange(v);
  }

  componentWillReceiveProps(nextProps) {
    const currValue = React.Children.only(this.props.children).props.value;
    const nextValue = React.Children.only(nextProps.children).props.value;
    if (currValue !== nextValue) {
      this.setState({ value: nextValue });
    }
    else if (nextProps.shouldUpdate ) {
      this.setState({ value: nextValue });
      nextProps.resetUpdate();
    }
  }

  onChange(e) {
    let value = e;
    if (e.persist && e.target) {
      e.persist();
      value = e.target.value;
    }
    this.setState({ value });
    this.debouncedOnChange(e);
  }

  render() {
    const { children, ...props } = this.props;
    const child = React.Children.only(children);
    return React.cloneElement(child, {
      ...filterInvalidDOMProps(props),
      ...this.state,
      onChange: v => this.onChange(v)
    });
  }
}
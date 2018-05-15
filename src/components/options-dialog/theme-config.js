import { connect } from "react-redux";
import Form from "react-jsonschema-form";
import { GithubPicker } from "react-color";
import colorsSchema from "../../lib/colors-schema";
import { applyColorScheme } from "../../actions/ui-actions";
import { themePalette } from "../../lib/colors";
const colorOptions = themePalette.map(c => "#"+c.getHexString());

function ColorPickerWidget ({ value, onChange }) {
  return <GithubPicker {...{
    color: value,
    colors: colorOptions,
    triangle: "top-left",
    onChange: c => onChange(c.hex)
  }}/>;
}

const uiSchema = {
  colors: {
    "canvas-border":  { "ui:widget": ColorPickerWidget },
    background:       { "ui:widget": ColorPickerWidget },
    point:            { "ui:widget": ColorPickerWidget },
    "end-point":      { "ui:widget": ColorPickerWidget },
    wall:             { "ui:widget": ColorPickerWidget },
    "air-wall":       { "ui:widget": ColorPickerWidget },
    railing:          { "ui:widget": ColorPickerWidget },
    border:           { "ui:widget": ColorPickerWidget },
    stairs:           { "ui:widget": ColorPickerWidget },
    "dimension-line": { "ui:widget": ColorPickerWidget },
    object:           { "ui:widget": ColorPickerWidget },
    region:           { "ui:widget": ColorPickerWidget },
    selection:        { "ui:widget": ColorPickerWidget }
  }
};

function ThemeDialogue ({ theme, dispatch }) {
  return <Form
    className="theme-config-form"
    formData={theme}
    schema={colorsSchema}
    uiSchema={uiSchema}
    onChange={e=>dispatch(applyColorScheme(e.formData))}
  >
    <p>Changes should auto-apply in real time.</p>
  </Form>;
}

function mapStateToProps ({ editor }) {
  return {
    theme: editor.get("colorScheme") || null
  };
}

export default connect(mapStateToProps)(ThemeDialogue);

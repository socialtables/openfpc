import { BaseButton } from "./base";
import { PAN_TOOL_NAME } from "../constants/tools";

const TOOL_NAME = PAN_TOOL_NAME;
const ToolButton = BaseButton(TOOL_NAME);

export default class PanningTool {
  constructor () {
    this.name = TOOL_NAME;
    this.toolButton = (
      <ToolButton>Pan</ToolButton>
    );
    this.enableDragPan = true;
  }
}

import { BaseButton } from "./base";
import { ROTATE_TOOL_NAME } from "../constants/tools";

const TOOL_NAME = ROTATE_TOOL_NAME;
const ToolButton = BaseButton(TOOL_NAME);
export default class RotateTool {
  constructor () {
    this.name = TOOL_NAME;
    this.toolButton = (
      <ToolButton
        additionalClasses={"rotate-tool"}
      >
        <span>Rotate</span>
      </ToolButton>
    );
    this.enableClickSelect = true;
    this.cursorHint = "Select boundary";
  }
}

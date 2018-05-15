import { BaseButton } from "./base";
import { Selector } from "../components/icons";
import { SELECT_TOOL_NAME } from "../constants/tools";

const TOOL_NAME = SELECT_TOOL_NAME;
const ToolButton = BaseButton(TOOL_NAME);
export default class SelectTool {
  constructor () {
    this.name = TOOL_NAME;
    this.toolButton = (
      <ToolButton
        dataTip="Select"
      >
        <Selector />
      </ToolButton>
    );
    this.enableClickSelect = true;
    this.enableBoxSelect = true;
    this.enableDragTranslate = true;
    this.enableTransformOverlay = true;
  }
}

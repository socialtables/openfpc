import { BaseButton } from "./base";
import { Window } from "../../components/icons";
import { WINDOW_OBJECT_TOOL_NAME } from "../../constants/tools";

const OBJECT_NAME = WINDOW_OBJECT_TOOL_NAME;
const ToolButton = BaseButton(OBJECT_NAME);
export default class WindowObjectTool {
  constructor () {
    this.name = OBJECT_NAME;
    this.toolButton = (
      <ToolButton
        dataTip="Window"
      >
        <Window />
      </ToolButton>
    );
  }
}

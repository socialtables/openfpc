import { BaseButton } from "./base";
import { Door } from "../../components/icons";
import { DOOR_OBJECT_TOOL_NAME } from "../../constants/tools";

const OBJECT_NAME = DOOR_OBJECT_TOOL_NAME;
const ToolButton = BaseButton(OBJECT_NAME);
export default class DoorObjectTool {
  constructor () {
    this.name = OBJECT_NAME;
    this.toolButton = (
      <ToolButton
        dataTip="Door"
      >
        <Door />
      </ToolButton>
    );
  }
}

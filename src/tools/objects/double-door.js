import { BaseButton } from "./base";
import { DoubleDoor } from "../../components/icons";
import { DOUBLE_DOOR_OBJECT_TOOL_NAME } from "../../constants/tools";

const OBJECT_NAME = DOUBLE_DOOR_OBJECT_TOOL_NAME;
const ToolButton = BaseButton(OBJECT_NAME);
export default class DoubleDoorObjectTool {
  constructor () {
    this.name = OBJECT_NAME;
    this.toolButton = (
      <ToolButton
        dataTip="Double Door"
      >
        <DoubleDoor />
      </ToolButton>
    );
  }
}

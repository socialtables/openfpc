import { BaseButton } from "./base";
import { Rigging } from "../../components/icons";
import { RIGGING_OBJECT_TOOL_NAME } from "../../constants/tools";

const OBJECT_NAME = RIGGING_OBJECT_TOOL_NAME;
const ToolButton = BaseButton(OBJECT_NAME);
export default class RiggingObjectTool {
  constructor () {
    this.name = OBJECT_NAME;
    this.toolButton = (
      <ToolButton
        dataTip="Rigging"
      >
        <Rigging />
      </ToolButton>
    );
  }
}

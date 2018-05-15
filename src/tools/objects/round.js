import { BaseButton } from "./base";
import { Round } from "../../components/icons";
import { ROUND_COLUMN_OBJECT_TOOL_NAME } from "../../constants/tools";

const OBJECT_NAME = ROUND_COLUMN_OBJECT_TOOL_NAME;
const ToolButton = BaseButton(OBJECT_NAME);
export default class RoundColumnObjectTool {
  constructor () {
    this.name = OBJECT_NAME;
    this.toolButton = (
      <ToolButton
        dataTip="Round Column"
      >
        <Round />
      </ToolButton>
    );
  }
}

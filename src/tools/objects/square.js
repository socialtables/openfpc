import { BaseButton } from "./base";
import { Square } from "../../components/icons";
import { SQUARE_COLUMN_OBJECT_TOOL_NAME } from "../../constants/tools";

const OBJECT_NAME = SQUARE_COLUMN_OBJECT_TOOL_NAME;
const ToolButton = BaseButton(OBJECT_NAME);
export default class SquareColumnObjectTool {
  constructor () {
    this.name = OBJECT_NAME;
    this.toolButton = (
      <ToolButton
        dataTip="Square Column"
      >
        <Square />
      </ToolButton>
    );
  }
}

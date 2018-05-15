import { BaseButton } from "./base";
import { DimensionLine } from "../../components/icons";
import { DIMENSION_LINE_TOOL_NAME } from "../../constants/tools";

const TOOL_NAME = DIMENSION_LINE_TOOL_NAME;
const ToolButton = BaseButton(TOOL_NAME);
export default class DimensionLineTool {
  constructor () {
    this.name = TOOL_NAME;
    this.toolButton = (
      <ToolButton
        dataTip="Dimension Line"
      >
        <DimensionLine />
      </ToolButton>
    );
  }
}

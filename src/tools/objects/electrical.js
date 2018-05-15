import { BaseButton } from "./base";
import { Electrical } from "../../components/icons";
import { ELECTRICAL_OUTLET_OBJECT_TOOL_NAME } from "../../constants/tools";

const OBJECT_NAME = ELECTRICAL_OUTLET_OBJECT_TOOL_NAME;
const ToolButton = BaseButton(OBJECT_NAME);
export default class ElectricalOutletObjectTool {
  constructor () {
    this.name = OBJECT_NAME;
    this.toolButton = (
      <ToolButton
        dataTip="Electrical Outlet"
      >
        <Electrical />
      </ToolButton>
    );
  }
}

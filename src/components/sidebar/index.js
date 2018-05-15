import { connect } from "react-redux";

import ObjectEditor from "./forms/permanent-objects";
import { BoundaryEditor, BoundaryArcEditor, BoundaryTypeEditor } from "./forms/boundaries";

import "./selection-edit-pane.less";

function SelectionEditPane ({
  dispatch,
  selection,
  entities,
  floorScale,
  floorUnits
}) {
  const selectedEntities = entities.filter(e => selection.get(e.get("id")));
  const selectedEntityCount = selectedEntities.count();

  const editPanes = [];

  if (selectedEntities.find(e => e.get("type") === "boundary")) {
    editPanes.push(BoundaryTypeEditor);
    editPanes.push(BoundaryArcEditor);
  }

  let paneTitle = "";

  if (selectedEntityCount === 1) {
    switch(selectedEntities.first().get("type")) {
    case "boundary":
      paneTitle = "Edit Boundary";
      editPanes.push(BoundaryEditor);
      break;
    case "object":
      paneTitle = "Edit Object";
      editPanes.push(ObjectEditor);
      break;
    default:
      break;
    }
  }
  else if (selectedEntityCount) {
    paneTitle = "Edit";
  }

  return <div className="edit-panel-container">
    <div className="edit-panel-content">
      <h1 className="panel-heading">{paneTitle}</h1>
      { editPanes.map((Pane, i) => (
        <Pane {...{
          entities,
          dispatch,
          selectedEntities,
          floorScale,
          floorUnits
        }} key={i}/>
      )) }
    </div>
  </div>;
}

function mapStateToProps({ floor }) {
  return {
    selection: floor.present.get("selection"),
    entities: floor.present.get("entities"),
    floorScale: floor.present.get("scale"),
    floorUnits: floor.present.get("units")
  };
}

export default connect(mapStateToProps)(SelectionEditPane);

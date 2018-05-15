import "./boundaries.less";
import classNames from "classnames";
import { Map } from "immutable";
import React, { Component } from "react";
import { connect } from "react-redux";
import {
  Vector3,
  Vector2,
  OrthographicCamera
} from "three";
import { Point, Boundary } from "../../../model";
import SceneMaintainer from "../../../lib/renderable-scene-maintainer";
import { setNewBoundaryType } from "../../../actions/ui-actions";
import { ADD_BOUNDARY_TOOL_NAME } from "../../../constants/tools";


const boundaryTypeMap = {
  "wall": "Wall",
  "air-wall": "Air Wall",
  "railing": "Railing",
  "border": "Border",
  "stairs": "Stairs",
  "object": "Object"
};

const boundarySceneArr = Object.keys(boundaryTypeMap).map(boundaryType => {
  const a = new Point({ x: 20, y: -10 });
  const b = new Point({ x: -20, y: 10 });
  const entities = new Map([
    a,
    b,
    new Boundary({
      boundaryType,
      start: a.get("id"),
      end: b.get("id")
    })
  ].reduce((o, e) => {
    o[e.get("id")] = e;
    return o;
  }, {}));
  return {
    entities,
    boundaryType,
    label: boundaryTypeMap[boundaryType]
  };
});

function BoundaryTools ({
  colorScheme,
  renderer,
  selectedTool,
  onSelectType,
  scenes = boundarySceneArr
}) {
  return <div className="boundary-tools">
    {scenes.map((scene, key) => {
      const boundaryToolClassNames = classNames({
        "boundary-tool": true,
        "boundary-tool--is-selected": selectedTool === scene.boundaryType
      });

      return <div
        className={ boundaryToolClassNames }
        onClick={ () => onSelectType(scene.boundaryType) }
        key={ key }
      >
        <SimpleFloorDisplay {...{
          floor: scene,
          colorScheme,
          renderer,
          width: 26,
          height: 16
        }}/>
        <span className="boundary-tool__label">{scene.label}</span>
      </div>;
    })}
  </div>;
}

const mapStateToProps = ({ editor }) => {
  const colorScheme = editor.get("colorScheme");
  const activeTool = (editor.get("activeTool") || {}).name === ADD_BOUNDARY_TOOL_NAME;
  const selectedTool = activeTool && editor.get("newBoundaryType");
  return { colorScheme, selectedTool };
};
const mapDispatchToProps = (dispatch) => ({
  onSelectType: (t) => dispatch(setNewBoundaryType(t))
});

export default connect(mapStateToProps, mapDispatchToProps)(BoundaryTools);

/**
 * Simplified renderer with no interactivity or complex updates
 */
class SimpleFloorDisplay extends Component {
  constructor (props) {
    super(props);
    const {
      colorScheme,
      renderer,
      floor,
      cameraCenter = new Vector3(0, 0, 0),
      cameraSize = new Vector2(26, 16)
    } = props;
    this.camera = new OrthographicCamera(
      -cameraSize.x * 0.5,
      cameraSize.x * 0.5,
      -cameraSize.y * 0.5,
      cameraSize.y * 0.5,
      -100,
      100
    );
    this.camera.position.copy(cameraCenter);
    this.camera.lookAt(new Vector3(0, 0, -1).add(cameraCenter));
    this.renderer = renderer;
    this.renderingContext = null;
    this.needsRender = false;
    this.rendering = false;
    this.sceneMaintainer = new SceneMaintainer({
      colorScheme,
      onAsyncLoadFinished: () => this._requestRender()
    });
    this.sceneMaintainer.syncFloorState(floor);
    this.backgroundOpacity = 0;
  }
  componentWillReceiveProps (nextProps) {
    if (nextProps.floor !== this.props.floor) {
      this.sceneMaintainer.syncFloorState(nextProps.floor);
      this._requestRender();
    }
    if (nextProps.colorScheme !== this.props.colorScheme) {
      this.sceneMaintainer.syncColorScheme(nextProps.colorScheme);
      this.renderer.setClearColor(this.sceneMaintainer.clearColor, this.backgroundOpacity);
      this._requestRender();
    }
  }
  render () {
    const { width, height } = this.props;
    return <canvas {...{ width, height }} ref={ r => this.canvas = r }/>;
  }
  _requestRender () {
    this.needsRender = true;
    if (!this.rendering) {
      this.rendering = true;
      this._renderFrame();
    }
  }
  _renderFrame() {
    if (this.needsRender) {
      this.renderer.render(this.sceneMaintainer.scene, this.camera);
      this.renderingContext.drawImage(this.renderer.domElement, 0, 0);
      this.needsRender = false;
    }
    requestAnimationFrame(this._renderFrame.bind(this));
  }
  componentDidMount () {
    const { width, height } = this.props;
    this.renderingContext = this.canvas.getContext("2d");
    this.renderer.setClearColor(this.sceneMaintainer.clearColor, this.backgroundOpacity);
    this.renderer.setSize(width, height);
    this._requestRender();
  }
  componentWillUnmount () {
    this.sceneMaintainer.disposeAll();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }
}

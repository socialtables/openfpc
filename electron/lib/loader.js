const Ajv = require("ajv/dist/ajv.bundle.js")({ v5: true, allErrors: true });
const v3FloorSchema = require("./schemas/st-v3-simplified");
const openFPCSchema = require("./schemas/openfpc");

const _mapBy = key => arr => arr.reduce((m, e) => { m[e[key]] = e; return m; }, {});

/**
 * Base class to make writing loaders easier
 */
class BaseLoader {
  static load () {
    throw new Error("not implemented on base class");
  }
  static canLoad (entity) {
    return !this.validator(entity);
  }
  static get validator() {
    const rawValidator = Ajv.compile(this.schema);
    return entity => {
      rawValidator(entity);
      if (rawValidator.errors) {
        return {
          errorMessages: rawValidator.errors.map(e => Ajv.errorsText([e])),
          errors: rawValidator.errors
        };
      }
      return null;
    };
  }
}

/**
 * Loader for social tables V3 floor dats
 */
class V3FloorLoader extends BaseLoader {
  static get schema() {
    return v3FloorSchema;
  }
  static load (floor) {
    const scale = floor.scale || 1;
    const points = floor.points.map(p => ({
      id: `${p.id}`,
      x: p.x,
      y: p.y
    }));
    const boundaries = (floor.boundaries || []).map(b => ({
      id: `${b.id}`,
      type: b.type,
      start: `${b.start_point_id}`,
      end: `${b.end_point_id}`,
      arc: b.arc_height
    }));
    const objects = (floor.objects || []).map(o => Object.assign(
      {
        id: `${o.id}`,
        type: o.type || null,
        x: o.x,
        y: o.y,
        regions: o.roomIds || [],
        boundary: o.boundary_id,
        isFlippedX: false,
        isFlippedY: false
      },
      o.json_config ?
        (({
          width=0,
          height=0,
          radius=0,
          direction,
          angle,
          elevation=0
        } = {}) => ({
          width: (width ? width : 2 * radius) / scale,
          height: (height ? height : 2 * radius) / scale,
          rotation: angle || 0,
          isFlippedX: !!direction,
          isFlippedY: false,
          elevation
        })) (JSON.parse(o.json_config)) : null
    ));
    const regions = (floor.rooms || []).map(r => ({
      id: `${r.id}`,
      boundaries: {
        perimeter: r.boundaryIds.map(b => `${b}`),
        holes: r.inner_rooms.map(innerId =>
          floor.rooms.find(room => room.id === innerId).boundaryIds
          .map(b => `${b}`)
        )
      }
    }));

    // link spatial parent relations
    const regionsById = _mapBy("id")(regions);
    (floor.rooms || []).forEach(r => {
      if (r.inner_rooms) {
        r.inner_rooms.forEach(i => {
          regionsById[`${i}`].parent = r.id;
        });
      }
    });

    // assign background image
    const backgroundImages = [];
    if (floor.floor_img) {
      backgroundImages.push({
        url: floor.floor_img,
        // FPC2 scene size constants and center point
        autoSizeOnLoad: [2400, 1600],
        centerX: 1200,
        centerY: 800
      });
    }

    return {
      scale,
      points,
      boundaries,
      objects,
      regions,
      backgroundImages
    };
  }
}

/**
 * Passthrough loader for OpenFPC saves
 */
class OpenFPCLoader extends BaseLoader {
  static get schema() {
    return openFPCSchema;
  }
  static load (floor) {
    return floor;
  }
}

const allLoaders = [V3FloorLoader, OpenFPCLoader];

function loadJSON (data) {
  const chosenLoader = allLoaders.find(l => l.canLoad(data));
  if (chosenLoader) {
    return chosenLoader.load(data);
  }
  const err = new Error("unable to interpret supplied data");
  err.loaderErrorMessages = allLoaders.reduce((m, l) => {
    m[l.name] = l.validator(data).errorMessages;
    return m;
  }, {});
  throw err;
}

module.exports = loadJSON;

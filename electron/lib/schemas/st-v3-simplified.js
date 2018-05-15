module.exports = {
  type: "object",
  properties: {
    name: { type: "string" },
    points: {
      type: "array",
      items: {
        type: "object",
        properties: {
          x:  { type: "number" },
          y:  { type: "number" },
          id: { type: ["number", "string"] }
        },
        required: [
          "x", "y", "id"
        ]
      }
    },
    boundaries: {
      type: "array",
      items: {
        type: "object",
        properties: {
          start_point_id: { type: ["number", "string"] },
          end_point_id:   { type: ["number", "string"] },
          id:             { type: ["number", "string"] },
          type:           { type: "string" },
          arc_height:     { type: ["number", "null", "string"] }
        },
        required: [
          "start_point_id",
          "end_point_id",
          "id",
          "type"
        ]
      }
    },
    rooms: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: ["number", "string"] },
          boundaryIds: {
            type: "array",
            items: {
              type: ["number", "string"]
            }
          }
        },
        required: [
          "id", "boundaryIds"
        ]
      }
    }
  },
  required: [
    "points",
    "name"
  ]
};

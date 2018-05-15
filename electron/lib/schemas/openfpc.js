module.exports = {
  type: "object",
  properties: {
    scale: {
      type: "number"
    },
    points: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: ["number", "string"] },
          x:  { type: "number" },
          y:  { type: "number" }
        },
        required: ["id", "x", "y"]
      }
    },
    boundaries: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id:    { type: ["number", "string"] },
          start: { type: ["number", "string"] },
          end:   { type: ["number", "string"] },
          type:  { type: "string" },
          arc:   { type: ["number", "null"] }
        },
        required: ["id", "start", "end", "type"]
      }
    },
    objects: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id:       { type: ["number", "string"] },
          type:     { type: "string" },
          x:        { type: "number" },
          y:        { type: "number" },
          width:    { type: "number" },
          height:   { type: "number" },
          rotation: { type: "number" },
          flipped:  { type: "boolean" },
          boundary: { type: ["number", "string", "null"] },
          regions: {
            type: ["array", "null"],
            items: {
              type: ["number", "string"]
            }
          }
        },
        required: ["id", "type", "x", "y"]
      }
    },
    regions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: ["number", "string"] },
          boundaries: {
            type: "object",
            properties: {
              perimeter: {
                type: "array",
                items: {
                  type: ["number", "string"]
                }
              },
              interior: {
                type: "array",
                items: {
                  type: ["number", "string"]
                }
              },
              holes: {
                type: "array",
                items: {
                  type: "array",
                  items: {
                    type: ["number", "string"]
                  }
                }
              }
            },
            required: ["perimeter"]
          }
        },
        required: ["id", "boundaries"]
      }
    }
  },
  required: [
    "points"
  ]
};

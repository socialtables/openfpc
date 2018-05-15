export default {
  type: "object",
  properties: {
    opacity: {
      type: "object",
      title: "Opacity",
      properties: {
        backgroundImages: {
          title: "Background Images",
          type: "number",
          default: 0.2,
          maximum: 1.0,
          minimum: 0,
          multipleOf: 0.05
        }
      }
    }
  }
};

const tailwindcss = require("tailwindcss");
const autoprefixer = require("autoprefixer");

const addStandardTextSizeAdjust = {
  postcssPlugin: "add-standard-text-size-adjust",
  Declaration(declaration) {
    if (declaration.prop !== "-webkit-text-size-adjust") return;

    const hasStandardProperty = declaration.parent?.nodes.some(
      (node) => node.type === "decl" && node.prop === "text-size-adjust",
    );

    if (!hasStandardProperty) {
      declaration.cloneAfter({ prop: "text-size-adjust" });
    }
  },
};

module.exports = {
  plugins: [tailwindcss, addStandardTextSizeAdjust, autoprefixer],
};

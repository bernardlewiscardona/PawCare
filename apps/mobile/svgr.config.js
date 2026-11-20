// SVGR options for react-native-svg-transformer (merged over its defaults).
// Plugins are passed as functions: under pnpm, Expo's transform worker cannot resolve them by
// name from inside @svgr/core.
const load = (name) => {
  const mod = require(name);
  return mod.default ?? mod;
};

module.exports = {
  plugins: [load('@svgr/plugin-svgo'), load('@svgr/plugin-jsx')],
  // Figma icons are drawn in text/primary (#111111). Compile that to currentColor so the
  // `color` prop recolours them; every wrapper passes text/primary by default.
  replaceAttrValues: { '#111111': 'currentColor' },
};

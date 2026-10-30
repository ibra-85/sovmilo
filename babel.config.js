module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      // jsxImportSource + nativewind/babel : permettent d'utiliser `className` sur les composants React Native.
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
      'nativewind/babel',
    ],
    // Les migrations Drizzle sont des fichiers .sql importés comme du texte brut.
    plugins: [['inline-import', { extensions: ['.sql'] }]],
  };
};

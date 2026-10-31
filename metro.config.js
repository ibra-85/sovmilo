const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// Permet à Metro de résoudre les migrations Drizzle (.sql).
config.resolver.sourceExts.push('sql');

// NativeWind lit `ImageBackground` (déprécié dans React Native) au démarrage, d'où l'avertissement
// « ImageBackground is deprecated ». On remplace uniquement ce fichier par une copie sans ImageBackground.
const cssInteropComponents = path.resolve(__dirname, 'config/css-interop-components.js');
const resolveWithNativeWind = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    moduleName === './components' &&
    context.originModulePath.split(path.sep).join('/').endsWith('react-native-css-interop/dist/runtime/wrap-jsx.js')
  ) {
    return { type: 'sourceFile', filePath: cssInteropComponents };
  }
  return (resolveWithNativeWind ?? context.resolveRequest)(context, moduleName, platform);
};

module.exports = withNativeWind(config, {
  input: './src/global.css',
  // 1 rem = 16 dp : sans cela NativeWind utilise 14 dp et nos tailles (text-base, h-14…) seraient trop petites.
  inlineRem: 16,
});

const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// Permet à Metro de résoudre les migrations Drizzle (.sql).
config.resolver.sourceExts.push('sql');

module.exports = withNativeWind(config, {
  input: './src/global.css',
  // 1 rem = 16 dp : sans cela NativeWind utilise 14 dp et nos tailles (text-base, h-14…) seraient trop petites.
  inlineRem: 16,
});

const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Disable package exports to prevent Metro from pulling in raw ESM files 
// that contain browser-unsupported `import.meta` syntax.
config.resolver.unstable_enablePackageExports = false;

module.exports = config;
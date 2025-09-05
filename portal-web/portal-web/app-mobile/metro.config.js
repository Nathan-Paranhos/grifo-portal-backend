const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Habilitar package exports para resolver módulos ESM como SWR
config.resolver.unstable_enablePackageExports = true;

// Configurações adicionais para resolver problemas com TypeScript
config.resolver.sourceExts = [...config.resolver.sourceExts, 'ts', 'tsx', 'mjs'];

// Configurações para resolver módulos ESM - ordem importa!
config.resolver.resolverMainFields = ['react-native', 'browser', 'module', 'main'];
config.resolver.platforms = ['ios', 'android', 'native', 'web'];

// Configurações específicas para resolver problemas com SWR e outros módulos ESM
config.resolver.unstable_conditionNames = ['react-native', 'browser', 'require', 'import'];

// Permitir importação de arquivos .mjs
config.resolver.assetExts = config.resolver.assetExts.filter(ext => ext !== 'mjs');

module.exports = config;
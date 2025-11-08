const { getDefaultConfig } = require('expo/metro-config');

// Since SDK 52+, Expo automatically configures Metro for monorepos
// No manual configuration needed
module.exports = getDefaultConfig(__dirname);

// Lets the app import @benki/shared straight from the monorepo, so mobile,
// web and the API all compile against one set of contracts.
const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);
const shared = path.resolve(__dirname, "../packages/shared");

config.watchFolders = [...(config.watchFolders ?? []), shared];
config.resolver.extraNodeModules = { ...(config.resolver.extraNodeModules ?? {}), "@benki/shared": shared };

module.exports = config;

// Monorepo setup: Metro must see the workspace root so it can resolve @netforge/shared and hoisted packages.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('node:path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');
const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [path.resolve(projectRoot, 'node_modules'), path.resolve(workspaceRoot, 'node_modules')];
config.resolver.unstable_enablePackageExports = false; // shared exposes "main" (CJS) which Metro handles best

module.exports = config;

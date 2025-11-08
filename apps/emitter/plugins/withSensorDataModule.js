const {
  withDangerousMod,
  withXcodeProject,
  withInfoPlist,
  IOSConfig,
} = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Expo Config Plugin for SensorDataModule
 *
 * This plugin:
 * 1. Copies native Swift/ObjC files from native-modules/ to ios/ folder
 * 2. Adds files to Xcode project
 * 3. Configures Swift bridging header
 * 4. Adds UIBackgroundModes for location tracking
 */

const NATIVE_FILES = [
  'SensorDataModule.swift',
  'SensorDataModule.m',
  'emitter-Bridging-Header.h',
];

/**
 * Copy native module files into the iOS project
 */
const withNativeModuleFiles = (config) => {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const sourceDir = path.join(projectRoot, 'native-modules', 'ios');
      const targetDir = config.modRequest.platformProjectRoot;
      const appName = config.modRequest.projectName || 'emitter';

      console.log('📦 Copying native module files...');

      // Copy Swift and ObjC files to root of ios folder
      for (const file of ['SensorDataModule.swift', 'SensorDataModule.m']) {
        const sourcePath = path.join(sourceDir, file);
        const targetPath = path.join(targetDir, file);

        if (fs.existsSync(sourcePath)) {
          fs.copyFileSync(sourcePath, targetPath);
          console.log(`  ✓ Copied ${file}`);
        } else {
          console.warn(`  ⚠️  Source file not found: ${file}`);
        }
      }

      // Copy bridging header to app folder
      const bridgingHeaderSource = path.join(sourceDir, 'emitter-Bridging-Header.h');
      const bridgingHeaderTarget = path.join(targetDir, appName, `${appName}-Bridging-Header.h`);

      if (fs.existsSync(bridgingHeaderSource)) {
        fs.copyFileSync(bridgingHeaderSource, bridgingHeaderTarget);
        console.log(`  ✓ Copied ${appName}-Bridging-Header.h`);
      }

      return config;
    },
  ]);
};

/**
 * Add files to Xcode project and configure bridging header
 */
const withXcodeProjectModifications = (config) => {
  return withXcodeProject(config, async (config) => {
    const xcodeProject = config.modResults;
    const appName = config.modRequest.projectName || 'emitter';

    console.log('🔧 Configuring Xcode project...');

    // Add Swift and ObjC files to the project
    // Note: The files should already be in the ios folder from withNativeModuleFiles

    // Add SensorDataModule.swift
    if (!xcodeProject.hasFile('SensorDataModule.swift')) {
      xcodeProject.addSourceFile(
        'SensorDataModule.swift',
        {},
        xcodeProject.findPBXGroupKey({ name: appName })
      );
      console.log('  ✓ Added SensorDataModule.swift to Xcode project');
    }

    // Add SensorDataModule.m
    if (!xcodeProject.hasFile('SensorDataModule.m')) {
      xcodeProject.addSourceFile(
        'SensorDataModule.m',
        {},
        xcodeProject.findPBXGroupKey({ name: appName })
      );
      console.log('  ✓ Added SensorDataModule.m to Xcode project');
    }

    // Configure Swift bridging header
    const configurations = xcodeProject.pbxXCBuildConfigurationSection();
    const bridgingHeaderPath = `${appName}/${appName}-Bridging-Header.h`;

    for (const key in configurations) {
      if (typeof configurations[key] === 'object' && configurations[key].buildSettings) {
        configurations[key].buildSettings.SWIFT_OBJC_BRIDGING_HEADER = bridgingHeaderPath;
        configurations[key].buildSettings.SWIFT_VERSION = '5.0';
      }
    }
    console.log('  ✓ Configured Swift bridging header');

    return config;
  });
};

/**
 * Add UIBackgroundModes for location tracking
 */
const withBackgroundLocationMode = (config) => {
  return withInfoPlist(config, (config) => {
    console.log('📝 Adding UIBackgroundModes to Info.plist...');

    if (!config.modResults.UIBackgroundModes) {
      config.modResults.UIBackgroundModes = [];
    }

    if (!config.modResults.UIBackgroundModes.includes('location')) {
      config.modResults.UIBackgroundModes.push('location');
      console.log('  ✓ Added location background mode');
    }

    return config;
  });
};

/**
 * Main plugin export
 */
module.exports = function withSensorDataModule(config) {
  console.log('\n🚀 Running SensorDataModule config plugin...\n');

  config = withNativeModuleFiles(config);
  config = withXcodeProjectModifications(config);
  config = withBackgroundLocationMode(config);

  console.log('✅ SensorDataModule plugin completed\n');

  return config;
};

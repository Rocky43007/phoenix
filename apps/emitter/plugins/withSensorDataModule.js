const {
  withDangerousMod,
  withXcodeProject,
  withInfoPlist,
  IOSConfig,
  AndroidConfig,
} = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Expo Config Plugin for Native Modules (Emitter)
 *
 * This plugin:
 * 1. iOS: Copies Swift/ObjC files and configures Xcode
 * 2. Android: Copies Kotlin files and registers package
 * 3. Adds background location support
 */

const NATIVE_FILES = [
  'SensorDataModule.swift',
  'SensorDataModule.m',
  'BLEPeripheralManager.swift',
  'BLEPeripheralManager.m',
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
      const modulesToCopy = [
        'SensorDataModule.swift',
        'SensorDataModule.m',
        'BLEPeripheralManager.swift',
        'BLEPeripheralManager.m',
        'NativeLogger.swift',
        'NativeLogger.m',
      ];

      for (const file of modulesToCopy) {
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

    const moduleFiles = [
      'SensorDataModule.swift',
      'SensorDataModule.m',
      'BLEPeripheralManager.swift',
      'BLEPeripheralManager.m',
      'NativeLogger.swift',
      'NativeLogger.m',
    ];

    for (const file of moduleFiles) {
      if (!xcodeProject.hasFile(file)) {
        xcodeProject.addSourceFile(
          file,
          {},
          xcodeProject.findPBXGroupKey({ name: appName })
        );
        console.log(`  ✓ Added ${file} to Xcode project`);
      }
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
 * Copy Android native module files
 */
const withAndroidNativeModuleFiles = (config) => {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const sourceDir = path.join(projectRoot, 'native-modules', 'android');
      const androidDir = config.modRequest.platformProjectRoot;

      // Get package name from config
      const packageName = AndroidConfig.Package.getPackage(config) || 'com.rocky43007.emitter';
      const packagePath = packageName.replace(/\./g, '/');
      const targetDir = path.join(androidDir, 'app', 'src', 'main', 'java', packagePath);

      console.log('📦 Copying Android native module files...');

      // Ensure target directory exists
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      const androidFiles = [
        'BLEPeripheralManager.kt',
        'SensorDataModule.kt',
        'NativeLogger.kt',
        'EmitterModulesPackage.kt',
      ];

      for (const file of androidFiles) {
        const sourcePath = path.join(sourceDir, file);
        const targetPath = path.join(targetDir, file);

        if (fs.existsSync(sourcePath)) {
          // Read and update package name
          let content = fs.readFileSync(sourcePath, 'utf8');
          content = content.replace(/package com\.rocky43007\.emitter/, `package ${packageName}`);

          fs.writeFileSync(targetPath, content);
          console.log(`  ✓ Copied ${file}`);
        } else {
          console.warn(`  ⚠️  Source file not found: ${file}`);
        }
      }

      return config;
    },
  ]);
};

/**
 * Modify Android MainApplication to register the package
 */
const withAndroidMainApplication = (config) => {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const androidDir = config.modRequest.platformProjectRoot;
      const packageName = AndroidConfig.Package.getPackage(config) || 'com.rocky43007.emitter';
      const packagePath = packageName.replace(/\./g, '/');
      const mainApplicationPath = path.join(
        androidDir,
        'app',
        'src',
        'main',
        'java',
        packagePath,
        'MainApplication.kt'
      );

      console.log('🔧 Configuring Android MainApplication...');

      if (fs.existsSync(mainApplicationPath)) {
        let content = fs.readFileSync(mainApplicationPath, 'utf8');

        // Check if already registered
        if (!content.includes('add(EmitterModulesPackage())')) {
          // Add import
          if (!content.includes(`import ${packageName}.EmitterModulesPackage`)) {
            content = content.replace(
              /(package .+\n)/,
              `$1\nimport ${packageName}.EmitterModulesPackage\n`
            );
          }

          // Add package to the list (works with new architecture)
          content = content.replace(
            /(\/\/ add\(MyReactNativePackage\(\)\))/,
            `$1\n              add(EmitterModulesPackage())`
          );

          fs.writeFileSync(mainApplicationPath, content);
          console.log('  ✓ Registered EmitterModulesPackage');
        } else {
          console.log('  ℹ️  EmitterModulesPackage already registered');
        }
      } else {
        console.warn('  ⚠️  MainApplication.kt not found');
      }

      return config;
    },
  ]);
};

/**
 * Main plugin export
 */
module.exports = function withSensorDataModule(config) {
  console.log('\n🚀 Running Emitter Native Modules config plugin...\n');

  // iOS setup
  config = withNativeModuleFiles(config);
  config = withXcodeProjectModifications(config);
  config = withBackgroundLocationMode(config);

  // Android setup
  config = withAndroidNativeModuleFiles(config);
  config = withAndroidMainApplication(config);

  console.log('✅ Native Modules plugin completed (iOS + Android)\n');

  return config;
};

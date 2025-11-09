const { withDangerousMod, withPlugins } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Copy native scanner modules to iOS and Android projects
 */
function withReceiverNativeModules(config) {
  return withPlugins(config, [
    // iOS: Copy BLEBeaconScanner Swift and Objective-C files
    (config) => {
      return withDangerousMod(config, [
        'ios',
        async (config) => {
          const iosProjectRoot = config.modRequest.platformProjectRoot;
          const projectName = path.basename(iosProjectRoot.replace(/\.xcodeproj$/, ''));
          const iosSourceDir = path.join(iosProjectRoot, projectName);

          // Source files
          const nativeModulesDir = path.join(config.modRequest.projectRoot, 'native-modules', 'ios');
          const swiftSource = path.join(nativeModulesDir, 'BLEBeaconScanner.swift');
          const objcSource = path.join(nativeModulesDir, 'BLEBeaconScanner.m');

          // Destination
          const swiftDest = path.join(iosSourceDir, 'BLEBeaconScanner.swift');
          const objcDest = path.join(iosSourceDir, 'BLEBeaconScanner.m');

          // Copy files
          if (fs.existsSync(swiftSource)) {
            fs.copyFileSync(swiftSource, swiftDest);
            console.log('✅ Copied BLEBeaconScanner.swift to iOS project');
          }

          if (fs.existsSync(objcSource)) {
            fs.copyFileSync(objcSource, objcDest);
            console.log('✅ Copied BLEBeaconScanner.m to iOS project');
          }

          return config;
        },
      ]);
    },

    // Android: Copy BLEBeaconScanner Kotlin file
    (config) => {
      return withDangerousMod(config, [
        'android',
        async (config) => {
          const androidProjectRoot = config.modRequest.platformProjectRoot;
          const packagePath = 'com/phoenix/receiver';
          const androidSourceDir = path.join(
            androidProjectRoot,
            'app',
            'src',
            'main',
            'java',
            packagePath
          );

          // Source file
          const nativeModulesDir = path.join(config.modRequest.projectRoot, 'native-modules', 'android');
          const kotlinSource = path.join(nativeModulesDir, 'BLEBeaconScanner.kt');

          // Destination
          const kotlinDest = path.join(androidSourceDir, 'BLEBeaconScanner.kt');

          // Ensure directory exists
          fs.mkdirSync(androidSourceDir, { recursive: true });

          // Copy file
          if (fs.existsSync(kotlinSource)) {
            fs.copyFileSync(kotlinSource, kotlinDest);
            console.log('✅ Copied BLEBeaconScanner.kt to Android project');
          }

          // Read MainApplication.kt to add module to package list
          const mainApplicationPath = path.join(androidSourceDir, 'MainApplication.kt');

          if (fs.existsSync(mainApplicationPath)) {
            let mainAppContent = fs.readFileSync(mainApplicationPath, 'utf8');

            // Check if BLEBeaconScanner is already added
            if (!mainAppContent.includes('BLEBeaconScanner()')) {
              // Find the packages list and add our module
              const packagesListRegex = /(override fun getPackages\(\): List<ReactPackage> \{[\s\S]*?return listOf\([\s\S]*?)(packages\.addAll\(PackageList\(this\)\.packages\))/;

              if (packagesListRegex.test(mainAppContent)) {
                // Add BLEBeaconScanner to the packages list
                mainAppContent = mainAppContent.replace(
                  /(packages\.addAll\(PackageList\(this\)\.packages\))/,
                  `packages.add(ReactPackage { BLEBeaconScanner(reactContext) })\n        $1`
                );

                // Ensure BLEBeaconScanner class is imported (add after other imports)
                if (!mainAppContent.includes('import com.phoenix.receiver.BLEBeaconScanner')) {
                  mainAppContent = mainAppContent.replace(
                    /(package com\.phoenix\.receiver\n)/,
                    '$1\nimport com.phoenix.receiver.BLEBeaconScanner\n'
                  );
                }

                fs.writeFileSync(mainApplicationPath, mainAppContent, 'utf8');
                console.log('✅ Added BLEBeaconScanner to Android MainApplication');
              }
            }
          }

          return config;
        },
      ]);
    },
  ]);
}

module.exports = withReceiverNativeModules;

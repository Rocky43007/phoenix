const { withDangerousMod, withPlugins, withXcodeProject, AndroidConfig } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Copy native scanner modules to iOS and Android projects
 */
function withReceiverNativeModules(config) {
  return withPlugins(config, [
    // iOS: Copy native module files
    (config) => {
      return withDangerousMod(config, [
        'ios',
        async (config) => {
          const projectRoot = config.modRequest.projectRoot;
          const iosProjectRoot = config.modRequest.platformProjectRoot;
          const appName = config.modRequest.projectName || 'receiver';
          const nativeModulesDir = path.join(projectRoot, 'native-modules', 'ios');

          console.log('📦 Copying native module files to iOS...');

          // Copy Swift and ObjC files to iOS root folder
          const modulesToCopy = [
            'BLEBeaconScanner.swift',
            'BLEBeaconScanner.m',
            'NativeLogger.swift',
            'NativeLogger.m',
          ];

          for (const file of modulesToCopy) {
            const sourcePath = path.join(nativeModulesDir, file);
            const targetPath = path.join(iosProjectRoot, file);

            if (fs.existsSync(sourcePath)) {
              fs.copyFileSync(sourcePath, targetPath);
              console.log(`  ✓ Copied ${file}`);
            }
          }

          // Copy bridging header to app folder
          const bridgingHeaderSource = path.join(nativeModulesDir, 'receiver-Bridging-Header.h');
          const bridgingHeaderTarget = path.join(iosProjectRoot, appName, `${appName}-Bridging-Header.h`);

          if (fs.existsSync(bridgingHeaderSource)) {
            fs.copyFileSync(bridgingHeaderSource, bridgingHeaderTarget);
            console.log(`  ✓ Copied ${appName}-Bridging-Header.h`);
          }

          return config;
        },
      ]);
    },

    // iOS: Add files to Xcode project and configure Swift
    (config) => {
      return withXcodeProject(config, (config) => {
        const xcodeProject = config.modResults;
        const appName = config.modRequest.projectName || 'receiver';

        console.log('🔧 Configuring Xcode project...');

        // Add source files to Xcode project
        const moduleFiles = [
          'BLEBeaconScanner.swift',
          'BLEBeaconScanner.m',
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

        // Configure Swift bridging header and version
        const configurations = xcodeProject.pbxXCBuildConfigurationSection();
        const bridgingHeaderPath = `${appName}/${appName}-Bridging-Header.h`;

        for (const key in configurations) {
          if (typeof configurations[key] === 'object' && configurations[key].buildSettings) {
            configurations[key].buildSettings.SWIFT_OBJC_BRIDGING_HEADER = bridgingHeaderPath;
            configurations[key].buildSettings.SWIFT_VERSION = '5.0';
          }
        }
        console.log('  ✓ Configured Swift bridging header and version');

        return config;
      });
    },

    // Android: Copy BLEBeaconScanner Kotlin file
    (config) => {
      return withDangerousMod(config, [
        'android',
        async (config) => {
          const androidProjectRoot = config.modRequest.platformProjectRoot;

          // Get package name from config
          const packageName = AndroidConfig.Package.getPackage(config) || 'com.rocky43007.receiver';
          const packagePath = packageName.replace(/\./g, '/');
          const androidSourceDir = path.join(
            androidProjectRoot,
            'app',
            'src',
            'main',
            'java',
            packagePath
          );

          console.log('📦 Copying Android native modules...');
          console.log(`  Package: ${packageName}`);

          // Source files
          const nativeModulesDir = path.join(config.modRequest.projectRoot, 'native-modules', 'android');

          // Ensure directory exists
          fs.mkdirSync(androidSourceDir, { recursive: true });

          const filesToCopy = [
            'BLEBeaconScanner.kt',
            'BLEBeaconScannerPackage.kt',
            'NativeLogger.kt',
            'NativeLoggerPackage.kt',
          ];

          // Copy files and update package names
          for (const file of filesToCopy) {
            const sourcePath = path.join(nativeModulesDir, file);
            const destPath = path.join(androidSourceDir, file);

            if (fs.existsSync(sourcePath)) {
              // Read and update package name
              let content = fs.readFileSync(sourcePath, 'utf8');
              content = content.replace(/package com\.phoenix\.receiver/, `package ${packageName}`);

              fs.writeFileSync(destPath, content);
              console.log(`  ✓ Copied ${file}`);
            }
          }

          // Read MainApplication.kt to add module to package list
          const mainApplicationPath = path.join(androidSourceDir, 'MainApplication.kt');

          console.log('🔧 Configuring Android MainApplication...');

          if (fs.existsSync(mainApplicationPath)) {
            let mainAppContent = fs.readFileSync(mainApplicationPath, 'utf8');
            let modified = false;

            // Add BLEBeaconScanner if not already added
            if (!mainAppContent.includes('BLEBeaconScanner(')) {
              // Look for the comment line where we can add modules
              const addPackageComment = /(\/\/ add\(MyReactNativePackage\(\)\))/;

              if (addPackageComment.test(mainAppContent)) {
                mainAppContent = mainAppContent.replace(
                  addPackageComment,
                  `$1\n              add(BLEBeaconScannerPackage())`
                );

                // Add import using dynamic package name
                if (!mainAppContent.includes(`import ${packageName}.BLEBeaconScanner`)) {
                  mainAppContent = mainAppContent.replace(
                    new RegExp(`(package ${packageName.replace(/\./g, '\\.')}\\n)`),
                    `$1\nimport ${packageName}.BLEBeaconScanner\nimport ${packageName}.BLEBeaconScannerPackage\n`
                  );
                }

                modified = true;
                console.log('  ✓ Added BLEBeaconScanner');
              }
            }

            // Add NativeLogger if not already added
            if (!mainAppContent.includes('NativeLogger(')) {
              const addPackageComment = /(\/\/ add\(MyReactNativePackage\(\)\))/;

              if (addPackageComment.test(mainAppContent)) {
                mainAppContent = mainAppContent.replace(
                  addPackageComment,
                  `$1\n              add(NativeLoggerPackage())`
                );

                // Add import using dynamic package name
                if (!mainAppContent.includes(`import ${packageName}.NativeLogger`)) {
                  mainAppContent = mainAppContent.replace(
                    new RegExp(`(package ${packageName.replace(/\./g, '\\.')}\\n)`),
                    `$1\nimport ${packageName}.NativeLogger\nimport ${packageName}.NativeLoggerPackage\n`
                  );
                }

                modified = true;
                console.log('  ✓ Added NativeLogger');
              }
            }

            if (modified) {
              fs.writeFileSync(mainApplicationPath, mainAppContent, 'utf8');
            }
          } else {
            console.warn('  ⚠️  MainApplication.kt not found');
          }

          return config;
        },
      ]);
    },
  ]);
}

module.exports = withReceiverNativeModules;

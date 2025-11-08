const { withDangerousMod, withXcodeProject, AndroidConfig } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const withAndroidBLEScanner = (config) => {
  return withDangerousMod(config, ['android', async (config) => {
    const projectRoot = config.modRequest.projectRoot;
    const packageName = 'com.rocky43007.receiver';

    // Source files
    const sourceFiles = [
      'BLEScannerModule.kt',
      'ReceiverModulesPackage.kt'
    ];

    // Copy native modules to android/app/src/main/java/com/rocky43007/receiver/
    const targetDir = path.join(projectRoot, 'android', 'app', 'src', 'main', 'java', 'com', 'rocky43007', 'receiver');
    const sourceDir = path.join(projectRoot, 'native-modules', 'android');

    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    for (const file of sourceFiles) {
      const sourcePath = path.join(sourceDir, file);
      const targetPath = path.join(targetDir, file);

      if (fs.existsSync(sourcePath)) {
        fs.copyFileSync(sourcePath, targetPath);
        console.log(`✓ Copied ${file} to Android project`);
      }
    }

    // Update MainApplication.kt
    const mainApplicationPath = path.join(targetDir, 'MainApplication.kt');
    if (fs.existsSync(mainApplicationPath)) {
      let content = fs.readFileSync(mainApplicationPath, 'utf8');

      // Add import if not present
      if (!content.includes('import com.rocky43007.receiver.ReceiverModulesPackage')) {
        content = content.replace(
          /(package .+\n)/,
          `$1\nimport com.rocky43007.receiver.ReceiverModulesPackage\n`
        );
      }

      // Add package to the list if not present
      if (!content.includes('add(ReceiverModulesPackage())')) {
        content = content.replace(
          /(\/\/ add\(MyReactNativePackage\(\)\))/,
          `$1\n              add(ReceiverModulesPackage())`
        );
      }

      fs.writeFileSync(mainApplicationPath, content);
      console.log('✓ Updated MainApplication.kt');
    }

    return config;
  }]);
};

const withIOSBLEScanner = (config) => {
  return withXcodeProject(config, async (config) => {
    const projectRoot = config.modRequest.projectRoot;
    const sourceFile = path.join(projectRoot, 'native-modules', 'ios', 'BLEScannerModule.swift');
    const targetFile = path.join(projectRoot, 'ios', 'BLEScannerModule.swift');

    if (fs.existsSync(sourceFile)) {
      fs.copyFileSync(sourceFile, targetFile);
      console.log('✓ Copied BLEScannerModule.swift to iOS project');
    }

    return config;
  });
};

module.exports = function withBLEScanner(config) {
  console.log('🚀 Running BLE Scanner config plugin...');
  config = withAndroidBLEScanner(config);
  config = withIOSBLEScanner(config);
  console.log('✅ BLE Scanner plugin completed (iOS + Android)');
  return config;
};

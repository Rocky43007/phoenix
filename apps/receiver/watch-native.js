#!/usr/bin/env node

/**
 * Watch native-modules directory and automatically run prebuild when files change
 *
 * Usage: node watch-native.js [platform]
 * Examples:
 *   node watch-native.js android
 *   node watch-native.js ios
 *   node watch-native.js (watches both)
 */

const chokidar = require('chokidar');
const { spawn } = require('child_process');
const path = require('path');

const platform = process.argv[2] || 'both';
const nativeModulesDir = path.join(__dirname, 'native-modules');

let isRebuilding = false;
let pendingRebuild = false;

console.log(`\n👀 Watching native-modules directory for changes...`);
console.log(`📱 Platform: ${platform}`);
console.log(`📂 Watching: ${nativeModulesDir}\n`);

const watcher = chokidar.watch(nativeModulesDir, {
  ignored: /(^|[\/\\])\../, // ignore dotfiles
  persistent: true,
  ignoreInitial: true,
});

function runPrebuild(changedFile) {
  if (isRebuilding) {
    pendingRebuild = true;
    console.log('⏳ Rebuild already in progress, will rebuild again after completion...\n');
    return;
  }

  isRebuilding = true;
  const fileName = path.basename(changedFile);

  console.log(`\n🔄 File changed: ${fileName}`);
  console.log(`⚙️  Running prebuild for ${platform}...\n`);

  const platforms = platform === 'both' ? ['android', 'ios'] : [platform];

  let currentIndex = 0;

  function buildNext() {
    if (currentIndex >= platforms.length) {
      console.log(`\n✅ Prebuild complete!\n`);
      console.log(`👀 Watching for changes...\n`);
      isRebuilding = false;

      // If there was a change during rebuild, trigger another one
      if (pendingRebuild) {
        pendingRebuild = false;
        setTimeout(() => runPrebuild(changedFile), 1000);
      }
      return;
    }

    const currentPlatform = platforms[currentIndex];
    console.log(`📱 Building ${currentPlatform}...`);

    const prebuild = spawn('npx', ['expo', 'prebuild', '--platform', currentPlatform, '--clean'], {
      stdio: 'inherit',
      shell: true,
    });

    prebuild.on('close', (code) => {
      if (code !== 0) {
        console.error(`\n❌ Prebuild failed for ${currentPlatform} with code ${code}\n`);
      }
      currentIndex++;
      buildNext();
    });
  }

  buildNext();
}

watcher
  .on('change', (filePath) => {
    runPrebuild(filePath);
  })
  .on('add', (filePath) => {
    runPrebuild(filePath);
  })
  .on('unlink', (filePath) => {
    runPrebuild(filePath);
  })
  .on('error', (error) => {
    console.error(`❌ Watcher error: ${error}`);
  });

console.log('Press Ctrl+C to stop watching\n');

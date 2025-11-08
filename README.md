# Phoenix Monorepo

A modern React Native monorepo featuring two applications (receiver and emitter) with shared packages for UI components, utilities, and configuration.

## Project Structure

```
phoenix/
├── apps/
│   ├── receiver/          # React Native receiver app
│   └── emitter/           # React Native emitter app
├── packages/
│   ├── ui/                # Shared UI components
│   ├── utils/             # Shared utilities and types
│   └── config/            # Shared ESLint, TypeScript, Prettier configs
├── pnpm-workspace.yaml    # pnpm workspace configuration
├── package.json           # Root package.json with workspace scripts
└── tsconfig.json          # Root TypeScript configuration
```

## Tech Stack

- **Package Manager**: pnpm with workspaces
- **Framework**: React Native with Expo Development Builds
- **Language**: TypeScript
- **Native Modules**: Bluetooth Low Energy (BLE) support via react-native-ble-plx
- **Linting**: ESLint
- **Formatting**: Prettier

## Prerequisites

- Node.js >= 18.0.0
- pnpm >= 8.0.0
- **For iOS development:**
  - macOS with Xcode installed
  - Ruby >= 3.0.0 (Homebrew Ruby recommended)
  - Bundler (`gem install bundler` - manages CocoaPods and other gems)
- **For Android development:**
  - Android Studio
  - Android SDK and NDK
  - Java Development Kit (JDK)

## Installation

Install pnpm if you haven't already:

```bash
npm install -g pnpm
```

Install all dependencies:

```bash
pnpm install
```

**Important:** After installing dependencies, you need to run prebuild and install iOS pods:

```bash
# Prebuild has already been run, but if you need to regenerate native folders:
cd apps/receiver && pnpm prebuild
cd ../emitter && pnpm prebuild

# For iOS, install CocoaPods dependencies using Bundler:
cd apps/receiver && bundle install && cd ios && bundle exec pod install
cd ../../emitter && bundle install && cd ios && bundle exec pod install
```

**Note:** We use Bundler to manage CocoaPods to ensure consistent gem versions across the team. Each app has a `Gemfile` that specifies the CocoaPods version and dependencies.

## Available Scripts

### Root Level Scripts

```bash
# Development
pnpm dev:receiver       # Start receiver app
pnpm dev:emitter        # Start emitter app

# Build
pnpm build:receiver     # Build receiver app
pnpm build:emitter      # Build emitter app

# Quality checks
pnpm lint               # Lint all packages
pnpm type-check         # Type check all packages
pnpm format             # Format all files with Prettier

# Maintenance
pnpm clean              # Clean all node_modules and build artifacts
```

### Individual App Scripts

Navigate to an app directory and run:

```bash
cd apps/receiver  # or apps/emitter

pnpm start        # Start Expo dev server with development build
pnpm android      # Build and run on Android device/emulator
pnpm ios          # Build and run on iOS device/simulator
pnpm web          # Run on web
pnpm prebuild     # Regenerate native folders (ios/android)
pnpm lint         # Lint this app
pnpm type-check   # Type check this app
```

**Note:** The apps use Expo Development Builds, which means:
- You need to build the native apps first before running them
- Custom native modules (like BLE) are fully supported
- Changes to native code require rebuilding the app
- JavaScript/TypeScript changes can be hot reloaded

## Shared Packages

### @phoenix/ui

Shared React Native UI components used across both apps.

**Components:**
- `Button` - Customizable button with primary/secondary variants
- `Text` - Text component with title/body/caption variants
- `Container` - Flex container with optional centering

**Usage:**
```typescript
import { Button, Text, Container } from '@phoenix/ui';

function MyComponent() {
  return (
    <Container centered>
      <Text variant="title">Hello World</Text>
      <Button title="Click me" onPress={() => {}} />
    </Container>
  );
}
```

### @phoenix/utils

Shared utilities, types, and constants.

**Exports:**
- Types: `Message`, `AppConfig`, `MessageHandler`
- Constants: `APP_NAME`, `APP_VERSION`, `COLORS`, `TIMEOUTS`
- Helpers: `generateId()`, `createMessage()`, `formatTimestamp()`, `delay()`

**Usage:**
```typescript
import { generateId, APP_NAME, COLORS } from '@phoenix/utils';

const id = generateId();
const appName = APP_NAME;
const primaryColor = COLORS.primary;
```

### @phoenix/config

Shared configuration files for ESLint, TypeScript, and Prettier.

## Development Workflow

### First Time Setup

1. **Build the native apps:**
   ```bash
   cd apps/receiver
   pnpm android  # or pnpm ios

   cd ../emitter
   pnpm android  # or pnpm ios
   ```

2. **Start the development server:**
   ```bash
   # From root directory
   pnpm dev:receiver  # Terminal 1
   pnpm dev:emitter   # Terminal 2
   ```

### Daily Development

1. **Start the dev server** and the apps will connect automatically
2. **Make changes to shared packages:**
   - Changes in `packages/ui` or `packages/utils` are immediately available to both apps
   - TypeScript path aliases are configured for seamless imports
   - Metro bundler watches all workspace packages

3. **Run quality checks:**
   ```bash
   pnpm lint
   pnpm type-check
   pnpm format
   ```

### Running on Physical iOS Device

**Option 1: Using Expo CLI (Easiest)**

1. Connect your iOS device via USB
2. Trust the device on both Mac and iPhone when prompted
3. Run the app with device flag:
   ```bash
   cd apps/receiver
   pnpm ios --device
   ```
   Expo will automatically:
   - Detect your connected device
   - Configure signing with your Apple ID
   - Build and install the app
   - Launch it on your device

**Option 2: Using Xcode (More Control)**

1. Open the workspace:
   ```bash
   open apps/receiver/ios/receiver.xcworkspace
   ```
2. In Xcode:
   - Select your physical device from the device dropdown (top toolbar)
   - Go to "Signing & Capabilities" tab
   - Select your Team (your Apple ID)
   - Xcode will auto-generate a provisioning profile
3. Click the Play button (▶) or press Cmd+R to build and run
4. First time only: Trust the developer certificate on your iPhone
   - Settings → General → VPN & Device Management → Trust your Apple ID

**Notes:**
- Both apps can run simultaneously (different bundle IDs)
- You need an Apple ID (free account works for development)
- Start the Metro bundler separately with `pnpm start` if needed

## Native Modules & Bluetooth

Both apps are configured with Bluetooth Low Energy (BLE) support using `react-native-ble-plx`.

### Permissions

**iOS** (configured in app.json):
- `NSBluetoothAlwaysUsageDescription`
- `NSBluetoothPeripheralUsageDescription`

**Android** (configured in app.json):
- `BLUETOOTH`
- `BLUETOOTH_ADMIN`
- `BLUETOOTH_SCAN`
- `BLUETOOTH_CONNECT`
- `BLUETOOTH_ADVERTISE`
- `ACCESS_FINE_LOCATION`
- `ACCESS_COARSE_LOCATION`

### Using BLE in Your App

```typescript
import { BleManager } from 'react-native-ble-plx';

const manager = new BleManager();

// Scan for devices
manager.startDeviceScan(null, null, (error, device) => {
  if (error) {
    console.error(error);
    return;
  }
  console.log('Found device:', device.name);
});
```

## Metro Configuration

The monorepo uses a custom Metro configuration to properly resolve workspace packages:

- Watches all files in the monorepo root
- Resolves modules from both app and root `node_modules`
- Disables hierarchical lookup for consistent resolution

This configuration is already set up in `apps/*/metro.config.js`.

## Adding New Packages

1. Create a new directory under `packages/`
2. Add a `package.json` with name `@phoenix/package-name`
3. The package will automatically be included in the workspace
4. Add it as a dependency in apps using `@phoenix/package-name: "workspace:*"`

## Adding Dependencies

```bash
# Add to root (devDependencies only)
pnpm add -D -w <package>

# Add to specific app
pnpm --filter receiver add <package>
pnpm --filter emitter add <package>

# Add to shared package
pnpm --filter @phoenix/ui add <package>
```

## Troubleshooting

### Metro bundler cache issues

```bash
cd apps/receiver  # or apps/emitter
pnpm start --clear
```

### TypeScript path resolution issues

Ensure your IDE is using the workspace TypeScript version and restart the TypeScript server.

### pnpm linking issues

```bash
pnpm install --force
```

### CocoaPods issues

If you encounter CocoaPods errors, try:

```bash
# Clean and reinstall gems
cd apps/receiver  # or apps/emitter
bundle install

# Clean and reinstall pods
cd ios
bundle exec pod deintegrate
bundle exec pod install
```

### iOS device not detected

If your iOS device isn't showing up:

1. **Check physical connection:**
   - Use an Apple-certified cable
   - Try a different USB port
   - Unlock your device

2. **Trust the computer:**
   - Unlock iPhone and tap "Trust" when prompted
   - Check Xcode → Window → Devices and Simulators

3. **Reset device pairing:**
   ```bash
   # Kill Xcode and related processes
   killall Xcode
   killall -9 com.apple.CoreSimulator.CoreSimulatorService
   ```

4. **Verify device is visible:**
   ```bash
   xcrun devicectl list devices
   ```

### Code signing errors

If you get signing errors:

1. **Add Apple ID to Xcode:**
   - Xcode → Settings → Accounts → + → Add Apple ID

2. **Select development team:**
   - Open workspace in Xcode
   - Select project → Signing & Capabilities
   - Choose your team from dropdown

3. **Clean and rebuild:**
   - Product → Clean Build Folder (Cmd+Shift+K)
   - Product → Build (Cmd+B)

## License

Private - All rights reserved

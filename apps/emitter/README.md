# Phoenix Emitter

React Native application for emitting messages via Bluetooth Low Energy, part of the Phoenix monorepo.

## Features

- Built with Expo Development Builds and TypeScript
- Full native module support (BLE via react-native-ble-plx)
- Uses shared UI components from `@phoenix/ui`
- Uses shared utilities from `@phoenix/utils`
- Configured with Bluetooth permissions for iOS and Android

## Getting Started

### First Time Setup

1. **Install dependencies** (from monorepo root):
   ```bash
   pnpm install
   ```

2. **Install iOS pods** (if developing for iOS):
   ```bash
   bundle install
   cd ios && bundle exec pod install && cd ..
   ```

   **Note:** We use Bundler to manage CocoaPods for consistent gem versions.

3. **Build the app**:
   ```bash
   # For Android
   pnpm android

   # For iOS
   pnpm ios
   ```

### Development

```bash
# Start development server
pnpm start

# Build and run on Android
pnpm android

# Build and run on iOS
pnpm ios

# Regenerate native folders if needed
pnpm prebuild
```

## Bluetooth Functionality

This app is configured to emit/advertise messages via BLE. The necessary permissions are already configured in `app.json`.

### Example BLE Usage

```typescript
import { BleManager } from 'react-native-ble-plx';

const manager = new BleManager();

// Start advertising as a peripheral
// Note: iOS has limitations on peripheral mode
const startAdvertising = async () => {
  // Setup your BLE service and characteristics
  // Advertise data to nearby devices
};
```

## Shared Dependencies

This app uses the following shared packages:
- `@phoenix/ui` - Shared UI components (Button, Text, Container)
- `@phoenix/utils` - Shared utilities, types, and constants

See the root README for more information about shared packages.

## Bundle Identifiers

- **iOS**: `com.phoenix.emitter`
- **Android**: `com.phoenix.emitter`

## Scripts

- `start` - Start Expo development server with dev client
- `android` - Build and run on Android
- `ios` - Build and run on iOS
- `prebuild` - Regenerate native ios/android folders
- `lint` - Run ESLint
- `type-check` - Run TypeScript type checking
- `clean` - Clean build artifacts and caches

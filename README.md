# Project Phoenix 🔥

**Emergency Beacon System for Disaster Relief**

Project Phoenix is a dual-app BLE beacon system designed for emergency situations and disaster relief operations. It enables devices to broadcast their location and sensor data via Bluetooth Low Energy, allowing rescue teams to locate people in distress even when cellular networks are down.

## 🎯 Features

### Emitter App (Victim/Person in Need)
- **BLE Beacon Broadcasting**: Transmits location and sensor data via Bluetooth
- **Adaptive Transmission**: Adjusts broadcast frequency based on battery level, motion, and emergency status
- **Sensor Integration**: GPS, accelerometer, gyroscope, compass, altimeter, and battery monitoring
- **Emergency Flags**: SOS activation, fall detection, motion detection, unstable environment detection
- **Power Efficient**: Smart intervals to preserve battery life

### Receiver App (Rescue Team)
- **BLE Beacon Scanning**: Discovers nearby Phoenix beacons
- **Precision Finding**: Apple AirTag-style UI for locating beacons with real-time distance and direction
- **GPS Fallback Mode**: Continues tracking using GPS when BLE signal is lost
- **RSSI Smoothing**: Advanced filtering for stable distance calculations
- **Priority Alerts**: Visual indicators for SOS, fall detection, and low battery
- **Multi-beacon Support**: Track multiple people simultaneously

## 📱 Apps

- **Emitter** (`apps/emitter`): Broadcasts beacon data
- **Receiver** (`apps/receiver`): Scans and locates beacons

## 🏗️ Architecture

```
phoenix/
├── apps/
│   ├── emitter/          # Beacon transmitter app
│   │   ├── native-modules/   # Native BLE peripheral & sensors
│   │   └── src/
│   └── receiver/         # Beacon scanner app
│       ├── native-modules/   # Native BLE central
│       └── src/
├── packages/
│   ├── beacon-protocol/  # Binary beacon data encoding/decoding
│   ├── ui/              # Shared UI components
│   └── utils/           # Shared utilities
└── count-lines.sh       # LOC counter script
```

## 🔧 Technology Stack

- **React Native 0.81** with Expo SDK 54
- **TypeScript** for type safety
- **Native Modules**:
  - Android: Kotlin (BLE, sensors)
  - iOS: Swift + Objective-C (BLE, sensors)
- **Monorepo**: pnpm workspaces
- **BLE**: Custom protocol with 20-byte payload

## 📊 Codebase Stats

Run `./count-lines.sh` to see detailed line counts:

```
Total Source Code: ~11,278 lines
- TypeScript/TSX: ~4,819 lines (43%)
- Kotlin (Android): ~2,952 lines (26%)
- Swift/Obj-C (iOS): ~2,761 lines (24%)
- Other: ~746 lines (7%)
```

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- pnpm 8+
- Xcode 15+ (for iOS)
- Android Studio (for Android)

### Installation

```bash
# Install dependencies
pnpm install

# Generate native projects (these are gitignored)
cd apps/emitter && pnpx expo prebuild
cd ../receiver && pnpx expo prebuild
```

### Running the Apps

**Emitter:**
```bash
cd apps/emitter
pnpm ios      # Run on iOS
pnpm android  # Run on Android
```

**Receiver:**
```bash
cd apps/receiver
pnpm ios      # Run on iOS
pnpm android  # Run on Android
```

## 📡 Beacon Protocol

### Packet Format (20 bytes)

```
[Device ID: 4 bytes]
[Latitude: 4 bytes (float)]
[Longitude: 4 bytes (float)]
[Altitude MSL: 2 bytes (int16)]
[Relative Altitude: 2 bytes (int16, cm)]
[Battery: 1 byte (0-100%)]
[Timestamp: 1 byte (seconds mod 256)]
[Flags: 1 byte]
[Reserved: 1 byte]
```

### Flags (1 byte)
- Bit 0: GPS Valid
- Bit 1: Motion Detected
- Bit 2: Low Battery (< 20%)
- Bit 3: SOS Activated
- Bit 4: Fall Detected
- Bit 5: Unstable Environment
- Bits 6-7: Reserved

### Manufacturer Data Format

**iOS Emitter → Any Receiver:**
```
Company ID: 0x004C (Apple)
[0x004C] [0x5048 "PH"] [20-byte beacon data]
```

**Android Emitter → Any Receiver:**
```
Company ID: 0x0075 (Samsung)
[0x0075] [0x5048 "PH"] [20-byte beacon data]
```

## 🎨 UI/UX

- **Dark Theme**: Sleek black background with modern glassmorphism cards
- **Precision Finding**: Circular compass UI with directional arrow
- **Real-time Updates**: 250ms refresh rate (4 updates/second)
- **Progressive Haptics**: Vibration feedback increases as you approach target
- **Imperial Units**: Distance shown in feet/inches

## 🔋 Power Management

Adaptive transmission intervals based on conditions:

- **Emergency** (SOS/Fall): 1 second
- **Critical Battery** (< 10%): 15 seconds
- **Low Battery** (< 20%): 10 seconds
- **Active** (moving): 3 seconds
- **Normal** (stationary): 5 seconds

## 🛠️ Development

### Project Structure

```
packages/beacon-protocol/  # Binary encoding/decoding
├── src/
│   ├── encoder.ts        # Encode sensor data to bytes
│   ├── decoder.ts        # Decode bytes to beacon data
│   └── config.ts         # Protocol constants
```

### Native Modules

**Android (Kotlin):**
- `BLEPeripheralManager.kt` - BLE advertising
- `BLEBeaconScanner.kt` - BLE scanning
- `SensorDataModule.kt` - Sensor data collection
- `NativeLogger.kt` - Native-to-JS logging

**iOS (Swift/Obj-C):**
- `BLEPeripheralManager.swift` - BLE advertising
- `BLEBeaconScanner.swift` - BLE scanning
- `SensorDataModule.swift` - Sensor data collection
- `NativeLogger.swift` - Native-to-JS logging

### Key Algorithms

**RSSI Distance Calculation:**
```typescript
distance = 10 ^ ((measuredPower - RSSI) / (10 * pathLossExponent))
// measuredPower = -59 dBm @ 1m
// pathLossExponent = 2.0 (free space)
```

**RSSI Smoothing:**
- 10-sample moving average
- IQR outlier rejection
- Weighted averaging (recent = higher weight)

**GPS Distance (Haversine):**
```typescript
distance = 2 * R * atan2(√a, √(1-a))
// R = Earth radius (6371 km)
```

## 📝 Git Workflow

### Important: Generated Files

The iOS and Android directories are **generated** by `expo prebuild` and are **not committed** to git. After cloning:

```bash
# Generate native projects
cd apps/emitter && pnpx expo prebuild
cd ../receiver && pnpx expo prebuild
```

### Native Module Development

Native module source files **are** committed:
- `apps/*/native-modules/android/*.kt`
- `apps/*/native-modules/ios/*.swift`
- `apps/*/native-modules/ios/*.m`

These are automatically copied during prebuild.

## 📝 License

This is a disaster relief project - use it to save lives.

## 🤝 Contributing

This is an emergency response tool. Contributions that improve reliability, battery life, or location accuracy are especially welcome.

---

**Built with ❤️ for emergency response and disaster relief operations**

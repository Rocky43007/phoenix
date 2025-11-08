/**
 * Phoenix Emergency Beacon Protocol Constants
 *
 * Binary packet format for BLE transmission
 */

// BLE Service and Characteristic UUIDs
export const BEACON_SERVICE_UUID = '0000FEED-0000-1000-8000-00805F9B34FB';
export const BEACON_COMMAND_CHAR_UUID = '0000FEEE-0000-1000-8000-00805F9B34FB';
export const BEACON_STATUS_CHAR_UUID = '0000FEEF-0000-1000-8000-00805F9B34FB';

// Packet Structure (20 bytes total - optimized for iBeacon)
export const PACKET_SIZE = 20;

export const PACKET_OFFSETS = {
  DEVICE_ID: 0,        // 4 bytes - UUID (reduced from 6 for iBeacon compatibility)
  LATITUDE: 4,         // 4 bytes - Float32
  LONGITUDE: 8,        // 4 bytes - Float32
  ALTITUDE_MSL: 12,    // 2 bytes - Int16 (meters above sea level)
  RELATIVE_ALT: 14,    // 2 bytes - Int16 (cm from start, for floor detection)
  BATTERY: 16,         // 1 byte  - 0-100%
  TIMESTAMP: 17,       // 2 bytes - Uint16 (seconds since boot)
  FLAGS: 19,           // 1 byte  - Bit flags
} as const;

export const PACKET_SIZES = {
  DEVICE_ID: 4,
  LATITUDE: 4,
  LONGITUDE: 4,
  ALTITUDE_MSL: 2,
  RELATIVE_ALT: 2,
  BATTERY: 1,
  TIMESTAMP: 2,
  FLAGS: 1,
} as const;

// Flag bits (1 byte = 8 bits)
export const FLAGS = {
  MOTION_DETECTED: 0x01,    // Bit 0: Accelerometer detected movement
  IS_CHARGING: 0x02,        // Bit 1: Device is charging
  SOS_ACTIVATED: 0x04,      // Bit 2: Manual SOS button pressed
  LOW_BATTERY: 0x08,        // Bit 3: Battery < 20%
  GPS_VALID: 0x10,          // Bit 4: GPS has valid fix
  STATIONARY: 0x20,         // Bit 5: No motion for 5+ minutes
  // Bits 6-7: Reserved for future use
} as const;

// Two-way Commands (sent from receiver to emitter)
export const COMMANDS = {
  PING: 0x01,      // Make emitter beep/vibrate
  FLASH: 0x02,     // Flash screen bright white
  STATUS: 0x03,    // Request full sensor data dump
  MARK_FOUND: 0x04, // Mark this emitter as found (stops advertising)
} as const;

// Advertisement Configuration
export const ADVERTISEMENT_CONFIG = {
  INTERVAL_NORMAL: 3000,        // 3 seconds (balanced mode)
  INTERVAL_POWER_SAVE: 5000,    // 5 seconds (battery < 50%)
  INTERVAL_CRITICAL: 10000,     // 10 seconds (battery < 20%)
  INTERVAL_ACTIVE: 2000,        // 2 seconds (motion detected)
  TX_POWER: 0,                  // 0 dBm (balanced range/battery)
} as const;

// Clustering Configuration
export const CLUSTERING_CONFIG = {
  EPSILON_METERS: 50,           // 50m radius for grouping
  MIN_POINTS: 1,                // Minimum emitters to form a cluster
  STALE_TIMEOUT_MS: 60000,      // 60 seconds - remove if not seen
} as const;

// Distance/RSSI Configuration
export const DISTANCE_CONFIG = {
  MEASURED_POWER: -59,          // RSSI at 1 meter (calibrated)
  PATH_LOSS_EXPONENT: 2.5,      // 2.0 = free space, 3.0-4.0 = indoor
  FLOOR_HEIGHT_METERS: 3.5,     // Average floor height for floor estimation
} as const;

// Protocol Version
export const PROTOCOL_VERSION = 1;

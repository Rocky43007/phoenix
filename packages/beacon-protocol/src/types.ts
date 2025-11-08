/**
 * TypeScript types for Phoenix Emergency Beacon Protocol
 */

// Beacon Data (decoded from binary packet)
export interface BeaconData {
  deviceId: string;            // Hex string representation of 6-byte ID
  latitude: number;            // Decimal degrees
  longitude: number;           // Decimal degrees
  altitudeMSL: number;         // Meters above sea level
  relativeAltitude: number;    // Centimeters from start position
  battery: number;             // 0-100%
  timestamp: number;           // Seconds since emitter boot
  flags: BeaconFlags;
}

// Decoded flag bits
export interface BeaconFlags {
  motionDetected: boolean;
  isCharging: boolean;
  sosActivated: boolean;
  lowBattery: boolean;
  gpsValid: boolean;
  stationary: boolean;
}

// Emitter with metadata (used by receiver app)
export interface Emitter extends BeaconData {
  rssi: number;                // Signal strength
  distance: number;            // Estimated distance in meters
  lastSeen: number;            // Timestamp (Date.now())
  isStale: boolean;            // Not seen for 60+ seconds
}

// Geographic location
export interface Location {
  latitude: number;
  longitude: number;
  altitude?: number;
}

// Cluster of emitters (for geographic grouping)
export interface EmitterCluster {
  id: string;                  // Unique cluster ID
  center: Location;            // Geographic center of cluster
  emitters: Emitter[];         // List of emitters in this cluster
  count: number;               // Number of emitters
  avgBattery: number;          // Average battery level
  urgencyScore: number;        // 0-100, higher = more urgent
  label?: string;              // Optional label (e.g., "Building 5")
}

// Command to send from receiver to emitter
export type BeaconCommand = 'PING' | 'FLASH' | 'STATUS' | 'MARK_FOUND';

// Full sensor data response (from STATUS command)
export interface FullSensorData extends BeaconData {
  accelerometer: {
    x: number;
    y: number;
    z: number;
  } | null;
  gyroscope: {
    x: number;
    y: number;
    z: number;
  } | null;
  compass: {
    magneticHeading: number;
    trueHeading: number;
  } | null;
  altimeter: {
    relativeAltitude: number;
    pressure: number;
  } | null;
  device: {
    model: string;
    systemName: string;
    systemVersion: string;
  };
}

// Encoder input (what emitter provides)
export interface EncoderInput {
  deviceId: string | Buffer;  // 6 bytes or hex string
  latitude: number;
  longitude: number;
  altitudeMSL: number;
  relativeAltitude: number;
  battery: number;             // 0-100
  timestamp: number;           // Seconds
  motionDetected: boolean;
  isCharging: boolean;
  sosActivated: boolean;
  lowBattery: boolean;
  gpsValid: boolean;
  stationary: boolean;
}

// Decoder output
export type DecoderOutput = BeaconData;

// Clustering algorithm input
export interface ClusteringInput {
  emitters: Emitter[];
  epsilonMeters: number;       // Radius for grouping
  minPoints: number;           // Minimum emitters to form cluster
}

// Clustering algorithm output
export interface ClusteringOutput {
  clusters: EmitterCluster[];
  noise: Emitter[];            // Emitters not in any cluster
}

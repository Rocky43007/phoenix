import { NativeModules } from 'react-native';

export interface LocationData {
  latitude: number;
  longitude: number;
  altitude: number;
  accuracy: number;
  altitudeAccuracy: number;
  speed: number;
  speedAccuracy: number;
  course: number;
  courseAccuracy: number;
  timestamp: number; // milliseconds since epoch
}

export interface AccelerometerData {
  x: number;
  y: number;
  z: number;
  timestamp: number; // milliseconds since epoch
}

export interface GyroscopeData {
  x: number; // radians/second
  y: number; // radians/second
  z: number; // radians/second
  timestamp: number; // milliseconds since epoch
}

export interface CompassData {
  magneticHeading: number; // degrees (0-359.9)
  trueHeading: number; // degrees (0-359.9)
  headingAccuracy: number; // degrees
  x: number; // microteslas
  y: number; // microteslas
  z: number; // microteslas
  timestamp: number; // milliseconds since epoch
}

export interface AltimeterData {
  relativeAltitude: number; // meters (relative to start point)
  pressure: number; // hPa (millibars)
  timestamp: number; // milliseconds since epoch
}

export interface BatteryInfo {
  level: number; // 0.0 to 1.0, or -1 if unavailable
  state: 'unknown' | 'unplugged' | 'charging' | 'full';
  isCharging: boolean;
}

export interface DeviceInfo {
  model: string;
  systemName: string;
  systemVersion: string;
  name: string;
  identifier: string;
}

export interface AllSensorData {
  location: LocationData | null;
  accelerometer: AccelerometerData | null;
  gyroscope: GyroscopeData | null;
  compass: CompassData | null;
  altimeter: AltimeterData | null;
  battery: BatteryInfo;
  device: DeviceInfo;
  timestamp: number; // milliseconds since epoch
}

export interface PermissionStatus {
  status: 'requested' | 'authorized' | 'denied' | 'unknown';
}

export interface OperationStatus {
  status: 'started' | 'stopped';
}

interface SensorDataModuleInterface {
  // Location methods
  requestLocationPermission(): Promise<PermissionStatus>;
  startLocationUpdates(): Promise<OperationStatus>;
  stopLocationUpdates(): Promise<OperationStatus>;
  getCurrentLocation(): Promise<LocationData>;

  // Accelerometer methods
  getAccelerometerData(): Promise<AccelerometerData>;
  startAccelerometerUpdates(): Promise<OperationStatus>;
  stopAccelerometerUpdates(): Promise<OperationStatus>;

  // Gyroscope methods
  getGyroscopeData(): Promise<GyroscopeData>;
  startGyroscopeUpdates(): Promise<OperationStatus>;
  stopGyroscopeUpdates(): Promise<OperationStatus>;

  // Compass/Magnetometer methods
  getCompassData(): Promise<CompassData>;
  startCompassUpdates(): Promise<OperationStatus>;
  stopCompassUpdates(): Promise<OperationStatus>;

  // Altimeter/Barometer methods
  getAltimeterData(): Promise<AltimeterData>;
  startAltimeterUpdates(): Promise<OperationStatus>;
  stopAltimeterUpdates(): Promise<OperationStatus>;

  // Battery methods
  getBatteryInfo(): Promise<BatteryInfo>;

  // Device info methods
  getDeviceInfo(): Promise<DeviceInfo>;

  // All sensor data
  getAllSensorData(): Promise<AllSensorData>;
}

const { SensorDataModule } = NativeModules;

if (!SensorDataModule) {
  throw new Error(
    'SensorDataModule native module is not available. ' +
    'Make sure you have rebuilt the native app after adding the module.'
  );
}

export default SensorDataModule as SensorDataModuleInterface;

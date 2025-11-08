/**
 * DataCollector Service
 *
 * Polls SensorDataModule and prepares data for beacon encoding
 */

import SensorDataModule, { AllSensorData } from '../modules/SensorDataModule';
import { EncoderInput } from '@phoenix/beacon-protocol';
import { Platform } from 'react-native';

export class DataCollector {
  private deviceId: string;
  private startAltitude: number = 0;
  private bootTime: number = Date.now();

  constructor(deviceId: string) {
    this.deviceId = deviceId;
  }

  /**
   * Initialize the data collector
   * Records initial altitude for relative altitude calculations
   */
  async initialize(): Promise<void> {
    try {
      const data = await SensorDataModule.getAllSensorData();

      // Record starting altitude for floor detection
      if (data.altimeter) {
        this.startAltitude = data.altimeter.relativeAltitude;
      } else if (data.location) {
        this.startAltitude = data.location.altitude;
      }
    } catch (error) {
      console.warn('Failed to initialize DataCollector:', error);
    }
  }

  /**
   * Collect current sensor data and prepare for encoding
   *
   * @returns EncoderInput ready for binary encoding
   */
  async collectData(): Promise<EncoderInput> {
    const sensorData = await SensorDataModule.getAllSensorData();

    // Extract priority data with fallbacks
    const latitude = sensorData.location?.latitude ?? 0;
    const longitude = sensorData.location?.longitude ?? 0;
    const altitudeMSL = sensorData.location?.altitude ?? 0;

    // Calculate relative altitude for floor detection
    let relativeAltitude = 0;
    if (sensorData.altimeter) {
      // Use barometer for more accurate floor detection
      relativeAltitude = Math.round((sensorData.altimeter.relativeAltitude - this.startAltitude) * 100); // meters to cm
    } else if (sensorData.location) {
      // Fallback to GPS altitude
      relativeAltitude = Math.round((sensorData.location.altitude - this.startAltitude) * 100);
    }

    const battery = sensorData.battery.level >= 0 ? Math.round(sensorData.battery.level * 100) : 0;

    // Calculate timestamp (seconds since boot)
    const timestamp = Math.floor((Date.now() - this.bootTime) / 1000);

    // Determine flags
    const motionDetected = this.detectMotion(sensorData);
    const isCharging = sensorData.battery.isCharging;
    const lowBattery = sensorData.battery.level < 0.2 && sensorData.battery.level >= 0;
    const gpsValid = sensorData.location != null && // checks both null and undefined
                     typeof sensorData.location.accuracy === 'number' &&
                     sensorData.location.accuracy < 100; // GPS accuracy < 100m
    const stationary = !motionDetected; // Inverse of motion (for now)

    return {
      deviceId: this.deviceId,
      latitude,
      longitude,
      altitudeMSL,
      relativeAltitude,
      battery,
      timestamp,
      motionDetected,
      isCharging,
      sosActivated: false, // TODO: Add SOS button in UI
      lowBattery,
      gpsValid,
      stationary,
    };
  }

  /**
   * Detect motion from accelerometer/gyroscope data
   *
   * @param sensorData - Current sensor readings
   * @returns true if motion detected
   */
  private detectMotion(sensorData: AllSensorData): boolean {
    // Check accelerometer for movement
    if (sensorData.accelerometer) {
      const { x, y, z } = sensorData.accelerometer;
      // Calculate total acceleration magnitude
      const magnitude = Math.sqrt(x * x + y * y + z * z);
      // Significant deviation from 1g (gravity) indicates motion
      return Math.abs(magnitude - 1.0) > 0.1;
    }

    // Check gyroscope for rotation
    if (sensorData.gyroscope) {
      const { x, y, z } = sensorData.gyroscope;
      const rotationMagnitude = Math.sqrt(x * x + y * y + z * z);
      // Any significant rotation indicates motion
      return rotationMagnitude > 0.5; // rad/s
    }

    // No motion sensors available, assume stationary
    return false;
  }

  /**
   * Generate a device ID from platform information
   *
   * @returns MAC-style device ID string
   */
  static async generateDeviceId(): Promise<string> {
    try {
      const deviceInfo = await SensorDataModule.getDeviceInfo();

      // Use vendor identifier as base
      const identifier = deviceInfo.identifier || 'unknown';

      // Convert to MAC-style format (6 bytes as hex pairs)
      // Take first 12 hex characters and format as MAC address
      const hex = identifier.replace(/-/g, '').substring(0, 12).toUpperCase();

      if (hex.length >= 12) {
        return `${hex.substring(0, 2)}:${hex.substring(2, 4)}:${hex.substring(4, 6)}:${hex.substring(6, 8)}:${hex.substring(8, 10)}:${hex.substring(10, 12)}`;
      }

      // Fallback: generate pseudo-random MAC
      return DataCollector.generateRandomMac();
    } catch (error) {
      console.warn('Failed to generate device ID from hardware:', error);
      return DataCollector.generateRandomMac();
    }
  }

  /**
   * Generate a random MAC-style address
   *
   * @returns Random MAC address string
   */
  private static generateRandomMac(): string {
    const bytes = Array.from({ length: 6 }, () =>
      Math.floor(Math.random() * 256)
        .toString(16)
        .padStart(2, '0')
        .toUpperCase()
    );
    return bytes.join(':');
  }
}

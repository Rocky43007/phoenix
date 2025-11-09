/**
 * BeaconTransmitter Service
 *
 * Manages BLE peripheral advertising for emergency beacon transmission
 */

import {
  encodeBeaconData,
  bufferToHex,
  ADVERTISEMENT_CONFIG,
} from '@phoenix/beacon-protocol';
import { DataCollector } from './DataCollector';
import SensorDataModule from '../modules/SensorDataModule';
import BLEPeripheralManager from '../modules/BLEPeripheralManager';
import { PermissionsAndroid, Platform } from 'react-native';

export type TransmitterStatus = 'idle' | 'starting' | 'advertising' | 'stopping' | 'error';

export interface TransmitterState {
  status: TransmitterStatus;
  error: string | null;
  lastTransmission: number | null;
  transmissionCount: number;
}

export class BeaconTransmitter {
  private dataCollector: DataCollector | null = null;
  private advertisingInterval: NodeJS.Timeout | null = null;
  private state: TransmitterState = {
    status: 'idle',
    error: null,
    lastTransmission: null,
    transmissionCount: 0,
  };
  private stateChangeCallback: ((state: TransmitterState) => void) | null = null;

  constructor() {
    // Native peripheral manager is used directly
  }

  /**
   * Initialize the beacon transmitter
   */
  async initialize(): Promise<void> {
    try {
      // Initialize BLE peripheral manager
      const result = await BLEPeripheralManager.initializePeripheral();
      console.log('BLE Peripheral Manager initialized:', result);

      // Check BLE state
      if (result.state !== 'poweredOn') {
        throw new Error(`Bluetooth is ${result.state}. Please enable Bluetooth.`);
      }

      // Request permissions
      await this.requestPermissions();

      // Generate device ID and initialize data collector
      const deviceId = await DataCollector.generateDeviceId();
      this.dataCollector = new DataCollector(deviceId);
      await this.dataCollector.initialize();

      console.log('BeaconTransmitter initialized with device ID:', deviceId);
    } catch (error) {
      console.error('Failed to initialize BeaconTransmitter:', error);
      this.updateState('error', `Initialization failed: ${error}`);
      throw error;
    }
  }

  /**
   * Start broadcasting beacon data
   */
  async startAdvertising(): Promise<void> {
    if (!this.dataCollector) {
      throw new Error('BeaconTransmitter not initialized');
    }

    if (this.state.status === 'advertising') {
      console.warn('Already advertising');
      return;
    }

    try {
      this.updateState('starting');

      // Start sensor updates
      await SensorDataModule.startLocationUpdates().catch((e) =>
        console.log('Location updates unavailable:', e)
      );
      await SensorDataModule.startAccelerometerUpdates().catch((e) =>
        console.log('Accelerometer updates unavailable:', e)
      );
      await SensorDataModule.startGyroscopeUpdates().catch((e) =>
        console.log('Gyroscope updates unavailable:', e)
      );
      await SensorDataModule.startAltimeterUpdates().catch((e) =>
        console.log('Altimeter updates unavailable:', e)
      );

      // Send first beacon immediately
      await this.transmitBeacon();

      // Note: Interval will be set dynamically in transmitBeacon() based on conditions

      this.updateState('advertising');
    } catch (error) {
      console.error('Failed to start advertising:', error);
      this.updateState('error', `Failed to start: ${error}`);
      throw error;
    }
  }

  /**
   * Stop broadcasting beacon data
   */
  async stopAdvertising(): Promise<void> {
    if (this.state.status !== 'advertising') {
      return;
    }

    try {
      this.updateState('stopping');

      // Stop advertising loop
      if (this.advertisingInterval) {
        clearInterval(this.advertisingInterval);
        this.advertisingInterval = null;
      }

      // Stop BLE advertising
      await BLEPeripheralManager.stopAdvertising();

      // Stop sensor updates
      await SensorDataModule.stopLocationUpdates();
      await SensorDataModule.stopAccelerometerUpdates();
      await SensorDataModule.stopGyroscopeUpdates();
      await SensorDataModule.stopAltimeterUpdates();

      this.updateState('idle');
    } catch (error) {
      console.error('Failed to stop advertising:', error);
      this.updateState('error', `Failed to stop: ${error}`);
      throw error;
    }
  }

  /**
   * Transmit a single beacon packet
   */
  private async transmitBeacon(): Promise<void> {
    if (!this.dataCollector) {
      console.error('DataCollector not initialized');
      return;
    }

    try {
      // Collect current sensor data
      const encoderInput = await this.dataCollector.collectData();

      // Encode to binary packet
      const packet = encodeBeaconData(encoderInput);
      const hexData = bufferToHex(packet);

      // Get current sensor data for accuracy logging
      const currentSensorData = await SensorDataModule.getAllSensorData();
      const gpsAccuracy = currentSensorData.location?.accuracy ?? 'N/A';

      console.log(`Transmitting beacon: ${hexData}`);
      console.log(`  📦 Payload size: ${packet.length} bytes (hex: ${hexData.length / 2} bytes)`);
      console.log('  Location:', encoderInput.latitude.toFixed(6), encoderInput.longitude.toFixed(6), 'Alt:', encoderInput.altitudeMSL + 'm');
      console.log(`  GPS Accuracy: ${typeof gpsAccuracy === 'number' ? gpsAccuracy.toFixed(1) + 'm' : gpsAccuracy}`);
      console.log('  Battery:', encoderInput.battery + '%');
      console.log('  Flags:');
      console.log('    GPS Valid:', encoderInput.gpsValid, `(accuracy ${typeof gpsAccuracy === 'number' ? '< 200m' : 'unknown'})`);
      console.log('    Motion:', encoderInput.motionDetected);
      console.log('    Fall:', encoderInput.fallDetected);
      console.log('    Unstable:', encoderInput.unstableEnvironment);

      // Stop current advertising before starting with new data
      await BLEPeripheralManager.stopAdvertising().catch(() => {
        // Ignore error if not advertising
      });

      // Start BLE advertising with new beacon data
      await BLEPeripheralManager.startAdvertising(hexData);

      // Update state
      this.state.lastTransmission = Date.now();
      this.state.transmissionCount++;
      this.notifyStateChange();

      // Adaptive interval based on conditions
      const interval = this.calculateAdaptiveInterval(encoderInput);

      // Clear old interval and set new one
      if (this.advertisingInterval) {
        clearInterval(this.advertisingInterval);
      }

      this.advertisingInterval = setInterval(
        () => this.transmitBeacon(),
        interval
      );

      console.log(`📡 Next transmission in ${interval / 1000}s`);

    } catch (error) {
      console.error('Failed to transmit beacon:', error);
      this.state.error = `Transmission failed: ${error}`;
      this.notifyStateChange();
    }
  }

  /**
   * Calculate adaptive interval based on battery, motion, and priority flags
   */
  private calculateAdaptiveInterval(data: any): number {
    // Priority 1: Emergency situations - fastest updates
    if (data.sosActivated || data.fallDetected || data.unstableEnvironment) {
      return ADVERTISEMENT_CONFIG.INTERVAL_EMERGENCY;
    }

    // Priority 2: Critical battery - conserve power
    if (data.battery < 10) {
      return ADVERTISEMENT_CONFIG.INTERVAL_CRITICAL;
    }

    // Priority 3: Low battery - save power
    if (data.lowBattery) { // < 20%
      return ADVERTISEMENT_CONFIG.INTERVAL_POWER_SAVE;
    }

    // Priority 4: Active (moving) - frequent updates
    if (data.motionDetected) {
      return ADVERTISEMENT_CONFIG.INTERVAL_ACTIVE;
    }

    // Default: Stationary with good battery - balanced
    return ADVERTISEMENT_CONFIG.INTERVAL_NORMAL;
  }

  /**
   * Get current transmitter state
   */
  getState(): TransmitterState {
    return { ...this.state };
  }

  /**
   * Subscribe to state changes
   */
  onStateChange(callback: (state: TransmitterState) => void): void {
    this.stateChangeCallback = callback;
  }

  /**
   * Update transmitter state
   */
  private updateState(status: TransmitterStatus, error: string | null = null): void {
    this.state.status = status;
    this.state.error = error;
    this.notifyStateChange();
  }

  /**
   * Notify subscribers of state change
   */
  private notifyStateChange(): void {
    if (this.stateChangeCallback) {
      this.stateChangeCallback({ ...this.state });
    }
  }

  /**
   * Request required permissions
   */
  private async requestPermissions(): Promise<void> {
    if (Platform.OS === 'android') {
      const granted = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      ]);

      const allGranted = Object.values(granted).every(
        (status) => status === PermissionsAndroid.RESULTS.GRANTED
      );

      if (!allGranted) {
        throw new Error('Required permissions not granted');
      }
    }
  }

  /**
   * Cleanup resources
   */
  async destroy(): Promise<void> {
    await this.stopAdvertising();
  }
}

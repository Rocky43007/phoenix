/**
 * BeaconScanner Service
 *
 * Uses react-native-ble-plx to discover Phoenix beacons
 * and decode their sensor data
 */

import { BleManager, Device, State } from 'react-native-ble-plx';
import { decodeBeaconData, ibeaconToBeacon, IBEACON_COMPANY_ID, type BeaconData } from '@phoenix/beacon-protocol';
import { PermissionsAndroid, Platform } from 'react-native';
import { Buffer } from 'buffer';

export type ScannerStatus = 'idle' | 'starting' | 'scanning' | 'stopping' | 'error';

export interface DiscoveredBeacon {
  id: string; // Device ID from beacon packet
  deviceId: string; // BLE device ID
  deviceName: string;
  beaconData: BeaconData | null;
  rssi: number;
  lastSeen: number;
  rawData: string;
}

export interface ScannerState {
  status: ScannerStatus;
  error: string | null;
  beaconsFound: Map<string, DiscoveredBeacon>;
}

export class BeaconScanner {
  private bleManager: BleManager;
  private state: ScannerState = {
    status: 'idle',
    error: null,
    beaconsFound: new Map(),
  };
  private stateChangeCallback: ((state: ScannerState) => void) | null = null;

  constructor() {
    this.bleManager = new BleManager();
  }

  /**
   * Initialize the beacon scanner
   */
  async initialize(): Promise<void> {
    try {
      // Request permissions
      await this.requestPermissions();

      // Check Bluetooth state
      const btState = await this.bleManager.state();
      console.log('Bluetooth state:', btState);

      if (btState !== State.PoweredOn) {
        throw new Error(`Bluetooth is ${btState}. Please enable Bluetooth.`);
      }

      console.log('BeaconScanner initialized successfully');
    } catch (error) {
      console.error('Failed to initialize BeaconScanner:', error);
      this.updateState('error', `Initialization failed: ${error}`);
      throw error;
    }
  }

  /**
   * Start scanning for beacons
   */
  async startScanning(): Promise<void> {
    if (this.state.status === 'scanning') {
      console.warn('Already scanning');
      return;
    }

    try {
      this.updateState('starting');

      // Clear previous beacons
      this.state.beaconsFound.clear();

      console.log('Starting BLE scan...');

      // Start scanning - allow duplicates to get RSSI updates
      this.bleManager.startDeviceScan(
        null, // No service UUID filter
        { allowDuplicates: true },
        (error, device) => {
          if (error) {
            console.error('BLE scan error:', error);
            this.updateState('error', `Scan error: ${error.message}`);
            return;
          }

          if (device) {
            this.handleDeviceDiscovered(device);
          }
        }
      );

      this.updateState('scanning');
      console.log('BLE scan started');
    } catch (error) {
      console.error('Failed to start scanning:', error);
      this.updateState('error', `Failed to start: ${error}`);
      throw error;
    }
  }

  /**
   * Stop scanning for beacons
   */
  async stopScanning(): Promise<void> {
    if (this.state.status !== 'scanning') {
      return;
    }

    try {
      this.updateState('stopping');

      this.bleManager.stopDeviceScan();
      console.log('BLE scan stopped');

      this.updateState('idle');
    } catch (error) {
      console.error('Failed to stop scanning:', error);
      this.updateState('error', `Failed to stop: ${error}`);
      throw error;
    }
  }

  /**
   * Handle a discovered BLE device
   */
  private handleDeviceDiscovered(device: Device): void {
    try {
      // Check if device has manufacturer data
      if (!device.manufacturerData) {
        return;
      }

      // Manufacturer data is base64 encoded
      const manufacturerDataBuffer = Buffer.from(device.manufacturerData, 'base64');

      if (manufacturerDataBuffer.length < 2) {
        return;
      }

      // Read company ID (little-endian)
      const companyID = manufacturerDataBuffer.readUInt16LE(0);

      // Only process iBeacon packets (Apple company ID 0x004C)
      if (companyID !== IBEACON_COMPANY_ID) {
        return;
      }

      // Verify it's an iBeacon by checking type and length
      if (manufacturerDataBuffer.length < 25) {
        return;
      }

      const ibeaconType = manufacturerDataBuffer.readUInt8(2);
      const ibeaconLength = manufacturerDataBuffer.readUInt8(3);

      if (ibeaconType !== 0x02 || ibeaconLength !== 0x15) {
        // Not an iBeacon, skip
        return;
      }

      console.log(`PHOENIX BEACON DETECTED! Device: ${device.name || device.id}, RSSI: ${device.rssi}`);

      // Extract 20-byte beacon data from iBeacon format
      const beaconDataBuffer = ibeaconToBeacon(manufacturerDataBuffer);

      // Decode beacon data
      const beaconData = decodeBeaconData(beaconDataBuffer);

      // Convert to hex for raw data display
      const hexData = manufacturerDataBuffer.toString('hex').toUpperCase();

      // Create beacon entry
      const beacon: DiscoveredBeacon = {
        id: beaconData.deviceId,
        deviceId: device.id,
        deviceName: device.name || 'Unknown',
        beaconData,
        rssi: device.rssi || 0,
        lastSeen: Date.now(),
        rawData: hexData,
      };

      // Update or add beacon
      this.state.beaconsFound.set(beaconData.deviceId, beacon);
      this.notifyStateChange();

      console.log(
        `Beacon discovered: ${beaconData.deviceId} at (${beaconData.latitude.toFixed(6)}, ${beaconData.longitude.toFixed(6)}) RSSI: ${device.rssi}`
      );
    } catch (error) {
      // Silently ignore decode errors for non-Phoenix devices
      if (device.name?.includes('Phoenix')) {
        console.error('Failed to decode beacon data:', error);
      }
    }
  }

  /**
   * Get current scanner state
   */
  getState(): ScannerState {
    return {
      ...this.state,
      beaconsFound: new Map(this.state.beaconsFound),
    };
  }

  /**
   * Get all discovered beacons as an array
   */
  getBeacons(): DiscoveredBeacon[] {
    return Array.from(this.state.beaconsFound.values()).sort(
      (a, b) => b.lastSeen - a.lastSeen
    ); // Most recent first
  }

  /**
   * Clear old beacons (not seen in last 30 seconds)
   */
  clearStaleBeacons(): void {
    const now = Date.now();
    const staleThreshold = 30000; // 30 seconds

    for (const [id, beacon] of this.state.beaconsFound.entries()) {
      if (now - beacon.lastSeen > staleThreshold) {
        this.state.beaconsFound.delete(id);
        console.log(`Removed stale beacon: ${id}`);
      }
    }

    this.notifyStateChange();
  }

  /**
   * Subscribe to state changes
   */
  onStateChange(callback: (state: ScannerState) => void): void {
    this.stateChangeCallback = callback;
  }

  /**
   * Update scanner state
   */
  private updateState(status: ScannerStatus, error: string | null = null): void {
    this.state.status = status;
    this.state.error = error;
    this.notifyStateChange();
  }

  /**
   * Notify subscribers of state change
   */
  private notifyStateChange(): void {
    if (this.stateChangeCallback) {
      this.stateChangeCallback(this.getState());
    }
  }

  /**
   * Request required permissions
   */
  private async requestPermissions(): Promise<void> {
    if (Platform.OS === 'android') {
      const granted = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      ]);

      const allGranted = Object.values(granted).every(
        (status) => status === PermissionsAndroid.RESULTS.GRANTED
      );

      if (!allGranted) {
        throw new Error('Required permissions not granted');
      }
    } else if (Platform.OS === 'ios') {
      // On iOS, BLE scanning requires location permission
      // Request it using expo-location which will trigger the system dialog
      try {
        const Location = require('expo-location');
        console.log('Requesting iOS location permission (required for BLE scanning)...');

        const { status } = await Location.requestForegroundPermissionsAsync();
        console.log('iOS location permission status:', status);

        if (status !== 'granted') {
          throw new Error('Location permission is required for BLE scanning on iOS');
        }
      } catch (error) {
        console.error('Failed to request iOS location permission:', error);
        throw new Error('Location permission is required for BLE scanning. Please enable it in Settings.');
      }
    }
  }

  /**
   * Cleanup resources
   */
  async destroy(): Promise<void> {
    await this.stopScanning();
    await this.bleManager.destroy();
  }
}

/**
 * BeaconScanner Service
 *
 * Scans for BLE beacons and decodes their data
 */

import { BleManager, Device, State } from 'react-native-ble-plx';
import { decodeBeaconData, hexToBuffer, type BeaconData } from '@phoenix/beacon-protocol';
import { PermissionsAndroid, Platform } from 'react-native';

export type ScannerStatus = 'idle' | 'starting' | 'scanning' | 'stopping' | 'error';

export interface DiscoveredBeacon {
  id: string; // Device ID from beacon
  device: Device; // BLE device object
  beaconData: BeaconData | null;
  rssi: number;
  lastSeen: number;
  rawData: string; // Hex string of manufacturer data
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
  private scanSubscription: any = null;

  // Phoenix Beacon manufacturer company ID
  private readonly PHOENIX_COMPANY_ID = 0xFFFF;

  constructor() {
    this.bleManager = new BleManager();
  }

  /**
   * Initialize the beacon scanner
   */
  async initialize(): Promise<void> {
    try {
      // Check BLE state
      const state = await this.bleManager.state();
      if (state !== State.PoweredOn) {
        throw new Error(`Bluetooth is ${state}. Please enable Bluetooth.`);
      }

      // Request permissions
      await this.requestPermissions();

      console.log('BeaconScanner initialized');
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

      // Start scanning for all devices
      // We'll filter for Phoenix beacons in the callback
      this.scanSubscription = this.bleManager.startDeviceScan(
        null, // Scan for all service UUIDs
        {
          allowDuplicates: true, // We want updates when RSSI changes
        },
        (error, device) => {
          if (error) {
            console.error('Scan error:', error);
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

      if (this.scanSubscription) {
        this.bleManager.stopDeviceScan();
        this.scanSubscription = null;
      }

      this.updateState('idle');
      console.log('BLE scan stopped');
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
      // Check if this is a Phoenix beacon by looking at manufacturer data
      if (!device.manufacturerData) {
        return;
      }

      // Parse manufacturer data (first 2 bytes are company ID, little-endian)
      const manufacturerDataHex = device.manufacturerData;
      const buffer = hexToBuffer(manufacturerDataHex);

      if (buffer.length < 2) {
        return;
      }

      // Read company ID (little-endian)
      const companyId = buffer.readUInt16LE(0);

      // Check if this is a Phoenix beacon
      if (companyId !== this.PHOENIX_COMPANY_ID) {
        return;
      }

      // Extract beacon data (skip first 2 bytes which are company ID)
      const beaconDataBuffer = buffer.slice(2);

      if (beaconDataBuffer.length !== 22) {
        console.warn(`Invalid beacon data length: ${beaconDataBuffer.length} (expected 22)`);
        return;
      }

      // Decode beacon data
      const beaconData = decodeBeaconData(beaconDataBuffer);

      // Create beacon entry
      const beacon: DiscoveredBeacon = {
        id: beaconData.deviceId,
        device,
        beaconData,
        rssi: device.rssi || -100,
        lastSeen: Date.now(),
        rawData: manufacturerDataHex,
      };

      // Update or add beacon
      this.state.beaconsFound.set(beaconData.deviceId, beacon);
      this.notifyStateChange();

      console.log(`Beacon discovered: ${beaconData.deviceId} at (${beaconData.latitude.toFixed(6)}, ${beaconData.longitude.toFixed(6)}) RSSI: ${device.rssi}`);
    } catch (error) {
      // Silently ignore decode errors for non-Phoenix devices
      // Only log if it looks like it might be a Phoenix beacon
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
    return Array.from(this.state.beaconsFound.values())
      .sort((a, b) => b.lastSeen - a.lastSeen); // Most recent first
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
    }
  }

  /**
   * Cleanup resources
   */
  async destroy(): Promise<void> {
    await this.stopScanning();
    this.bleManager.destroy();
  }
}

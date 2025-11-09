import { NativeModules, NativeEventEmitter, EmitterSubscription } from 'react-native';

const { BLEBeaconScanner: NativeBLEBeaconScanner } = NativeModules;

export interface BeaconDiscoveredEvent {
  deviceId: string;
  deviceName: string;
  beaconData: string; // Hex string
  rssi: number;
  measuredPower: number;
  timestamp: number;
}

export interface ScanningStateChangeEvent {
  scanning: boolean;
  error?: string;
}

class BLEBeaconScannerModule {
  private eventEmitter: NativeEventEmitter;

  constructor() {
    this.eventEmitter = new NativeEventEmitter(NativeBLEBeaconScanner);
  }

  /**
   * Initialize the BLE beacon scanner
   */
  async initializeScanner(): Promise<{ initialized: boolean; state: string }> {
    return NativeBLEBeaconScanner.initializeScanner();
  }

  /**
   * Start scanning for beacons
   */
  async startScanning(): Promise<{ scanning: boolean }> {
    return NativeBLEBeaconScanner.startScanning();
  }

  /**
   * Stop scanning for beacons
   */
  async stopScanning(): Promise<{ scanning: boolean }> {
    return NativeBLEBeaconScanner.stopScanning();
  }

  /**
   * Check if currently scanning
   */
  async isCurrentlyScanning(): Promise<{ scanning: boolean }> {
    return NativeBLEBeaconScanner.isCurrentlyScanning();
  }

  /**
   * Get Bluetooth state
   */
  async getBluetoothState(): Promise<{ state: string; scanning?: boolean }> {
    return NativeBLEBeaconScanner.getBluetoothState();
  }

  /**
   * Listen for beacon discovered events
   */
  onBeaconDiscovered(callback: (event: BeaconDiscoveredEvent) => void): EmitterSubscription {
    return this.eventEmitter.addListener('onBeaconDiscovered', callback);
  }

  /**
   * Listen for scanning state changes
   */
  onScanningStateChange(callback: (event: ScanningStateChangeEvent) => void): EmitterSubscription {
    return this.eventEmitter.addListener('onScanningStateChange', callback);
  }
}

export default new BLEBeaconScannerModule();

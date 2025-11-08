import { NativeModules, NativeEventEmitter, Platform } from 'react-native';

const { BLEScannerModule: Native } = NativeModules;

if (!Native) {
  throw new Error('BLEScannerModule native module not found');
}

export interface BLEInitializeResult {
  state: string;
  initialized: boolean;
}

export interface BLEScanStatus {
  isScanning: boolean;
  status: string;
}

export interface BLEState {
  state: string;
  isScanning: boolean;
}

export interface DiscoveredDevice {
  deviceId: string;
  deviceName: string;
  rssi: number;
  manufacturerData: { [key: string]: string };
}

export interface ScanError {
  errorCode?: number;
  errorMessage: string;
}

class BLEScannerModuleClass {
  private eventEmitter: NativeEventEmitter;

  constructor() {
    this.eventEmitter = new NativeEventEmitter(Native);
  }

  /**
   * Initialize the BLE scanner
   */
  async initializeScanner(): Promise<BLEInitializeResult> {
    return Native.initializeScanner();
  }

  /**
   * Start scanning for BLE devices
   */
  async startScanning(): Promise<BLEScanStatus> {
    return Native.startScanning();
  }

  /**
   * Stop scanning for BLE devices
   */
  async stopScanning(): Promise<BLEScanStatus> {
    return Native.stopScanning();
  }

  /**
   * Get current Bluetooth state
   */
  async getBluetoothState(): Promise<BLEState> {
    return Native.getBluetoothState();
  }

  /**
   * Subscribe to device discovered events
   */
  onDeviceDiscovered(callback: (device: DiscoveredDevice) => void): { remove: () => void } {
    return this.eventEmitter.addListener('onDeviceDiscovered', callback);
  }

  /**
   * Subscribe to scan failed events
   */
  onScanFailed(callback: (error: ScanError) => void): { remove: () => void } {
    return this.eventEmitter.addListener('onScanFailed', callback);
  }

  /**
   * Remove all listeners
   */
  removeAllListeners(): void {
    this.eventEmitter.removeAllListeners('onDeviceDiscovered');
    this.eventEmitter.removeAllListeners('onScanFailed');
  }
}

export default new BLEScannerModuleClass();

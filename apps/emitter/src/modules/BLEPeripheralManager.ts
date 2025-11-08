import { NativeModules } from 'react-native';

export interface BLEState {
  state: 'unknown' | 'resetting' | 'unsupported' | 'unauthorized' | 'poweredOff' | 'poweredOn' | 'uninitialized';
}

export interface BLEAdvertisingStatus {
  advertising: boolean;
  dataLength?: number;
}

export interface BLEInitializeResult {
  initialized: boolean;
  state: string;
}

interface BLEPeripheralManagerInterface {
  /**
   * Initialize the BLE peripheral manager
   */
  initializePeripheral(): Promise<BLEInitializeResult>;

  /**
   * Start advertising with beacon data
   *
   * @param beaconData - Hex string of beacon data (22 bytes)
   */
  startAdvertising(beaconData: string): Promise<BLEAdvertisingStatus>;

  /**
   * Stop advertising
   */
  stopAdvertising(): Promise<BLEAdvertisingStatus>;

  /**
   * Check if currently advertising
   */
  isCurrentlyAdvertising(): Promise<BLEAdvertisingStatus>;

  /**
   * Get current Bluetooth state
   */
  getBluetoothState(): Promise<BLEState>;
}

const { BLEPeripheralManager } = NativeModules;

if (!BLEPeripheralManager) {
  throw new Error(
    'BLEPeripheralManager native module is not available. ' +
    'Make sure you have rebuilt the native app after adding the module.'
  );
}

export default BLEPeripheralManager as BLEPeripheralManagerInterface;

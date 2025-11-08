/**
 * Phoenix Emergency Beacon Protocol
 *
 * Shared protocol for BLE-based emergency beacon transmission
 * between emitter and receiver applications
 */

// Export constants
export * from './constants';

// Export types
export * from './types';

// Export encoder functions
export {
  encodeBeaconData,
  bufferToHex,
  macToBuffer,
  generateDeviceId,
} from './encoder';

// Export decoder functions
export {
  decodeBeaconData,
  bufferToMacAddress,
  bufferToDeviceId,
  hexToBuffer,
  isValidBeaconPacket,
} from './decoder';

// Export iBeacon utilities
export {
  beaconToIBeacon,
  ibeaconToBeacon,
  createIBeaconManufacturerData,
  isIBeacon,
  ibeaconToHex,
  IBEACON_COMPANY_ID,
  IBEACON_TYPE,
  IBEACON_LENGTH,
  IBEACON_MEASURED_POWER,
} from './ibeacon';

// Export clustering functions
export {
  clusterEmitters,
  calculateDistance,
  calculateCenter,
  calculateUrgencyScore,
  sortClustersByUrgency,
  filterStaleEmitters,
} from './clustering';

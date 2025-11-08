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
  hexToBuffer,
  isValidBeaconPacket,
} from './decoder';

// Export clustering functions
export {
  clusterEmitters,
  calculateDistance,
  calculateCenter,
  calculateUrgencyScore,
  sortClustersByUrgency,
  filterStaleEmitters,
} from './clustering';

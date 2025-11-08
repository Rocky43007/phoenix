/**
 * iBeacon Formatting Utilities
 *
 * Converts 20-byte beacon data to/from iBeacon manufacturer data format
 * for cross-platform BLE advertising (iOS ↔ Android)
 */

import { PACKET_SIZE } from './constants';

// iBeacon constants
export const IBEACON_COMPANY_ID = 0x004C; // Apple Inc.
export const IBEACON_TYPE = 0x02;
export const IBEACON_LENGTH = 0x15; // 21 bytes
export const IBEACON_MEASURED_POWER = -59; // Standard calibration value at 1m

/**
 * Convert 20-byte beacon data to iBeacon manufacturer data
 *
 * iBeacon format (23 bytes without company ID):
 * - Type: 0x02 (1 byte)
 * - Length: 0x15 (1 byte)
 * - UUID: 16 bytes (our first 16 bytes: Device ID + Lat + Long + Altitudes)
 * - Major: 2 bytes (our bytes 16-17: Battery + Flags)
 * - Minor: 2 bytes (our bytes 18-19: Timestamp)
 * - Measured Power: 1 byte (TX power at 1m)
 *
 * @param beaconData - 20-byte beacon packet
 * @returns iBeacon manufacturer data (23 bytes)
 */
export function beaconToIBeacon(beaconData: Buffer): Buffer {
  if (beaconData.length !== PACKET_SIZE) {
    throw new Error(`Invalid beacon data size: expected ${PACKET_SIZE}, got ${beaconData.length}`);
  }

  const ibeacon = Buffer.alloc(23);

  // iBeacon header
  ibeacon.writeUInt8(IBEACON_TYPE, 0);
  ibeacon.writeUInt8(IBEACON_LENGTH, 1);

  // UUID (16 bytes): bytes 0-15 of beacon data
  beaconData.copy(ibeacon, 2, 0, 16);

  // Major (2 bytes): bytes 16-17 of beacon data (Battery + Flags)
  beaconData.copy(ibeacon, 18, 16, 18);

  // Minor (2 bytes): bytes 18-19 of beacon data (Timestamp)
  beaconData.copy(ibeacon, 20, 18, 20);

  // Measured Power (1 byte)
  ibeacon.writeInt8(IBEACON_MEASURED_POWER, 22);

  return ibeacon;
}

/**
 * Extract 20-byte beacon data from iBeacon manufacturer data
 *
 * @param manufacturerData - iBeacon manufacturer data (with or without company ID prefix)
 * @returns 20-byte beacon packet
 */
export function ibeaconToBeacon(manufacturerData: Buffer): Buffer {
  // Handle both formats: with company ID (25 bytes) or without (23 bytes)
  let offset = 0;

  // If starts with company ID (0x4C00 in little-endian), skip it
  if (manufacturerData.length >= 25 && manufacturerData.readUInt16LE(0) === IBEACON_COMPANY_ID) {
    offset = 2;
  }

  // Verify iBeacon header
  if (manufacturerData.readUInt8(offset) !== IBEACON_TYPE) {
    throw new Error('Invalid iBeacon type');
  }
  if (manufacturerData.readUInt8(offset + 1) !== IBEACON_LENGTH) {
    throw new Error('Invalid iBeacon length');
  }

  const beaconData = Buffer.alloc(PACKET_SIZE);

  // UUID → bytes 0-15
  manufacturerData.copy(beaconData, 0, offset + 2, offset + 18);

  // Major → bytes 16-17
  manufacturerData.copy(beaconData, 16, offset + 18, offset + 20);

  // Minor → bytes 18-19
  manufacturerData.copy(beaconData, 18, offset + 20, offset + 22);

  return beaconData;
}

/**
 * Create full iBeacon manufacturer data with company ID
 * (Ready for BLE advertising)
 *
 * @param beaconData - 20-byte beacon packet
 * @returns Full manufacturer data (25 bytes) with company ID prefix
 */
export function createIBeaconManufacturerData(beaconData: Buffer): Buffer {
  const ibeacon = beaconToIBeacon(beaconData);
  const manufacturerData = Buffer.alloc(25);

  // Company ID (little-endian)
  manufacturerData.writeUInt16LE(IBEACON_COMPANY_ID, 0);

  // iBeacon data
  ibeacon.copy(manufacturerData, 2);

  return manufacturerData;
}

/**
 * Check if manufacturer data is a valid iBeacon packet
 *
 * @param manufacturerData - Manufacturer data buffer
 * @returns true if valid iBeacon format
 */
export function isIBeacon(manufacturerData: Buffer): boolean {
  if (manufacturerData.length < 23) {
    return false;
  }

  let offset = 0;

  // Skip company ID if present
  if (manufacturerData.length >= 25 && manufacturerData.readUInt16LE(0) === IBEACON_COMPANY_ID) {
    offset = 2;
  }

  // Check iBeacon header
  return (
    manufacturerData.readUInt8(offset) === IBEACON_TYPE &&
    manufacturerData.readUInt8(offset + 1) === IBEACON_LENGTH
  );
}

/**
 * Convert iBeacon manufacturer data to hex string for debugging
 *
 * @param manufacturerData - iBeacon data
 * @returns Hex string
 */
export function ibeaconToHex(manufacturerData: Buffer): string {
  return manufacturerData.toString('hex').toUpperCase();
}

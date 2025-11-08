/**
 * Binary Decoder for Phoenix Emergency Beacon Protocol
 *
 * Decodes 20-byte binary packets into structured BeaconData
 */

import { PACKET_SIZE, PACKET_OFFSETS, PACKET_SIZES, FLAGS } from './constants';
import type { BeaconData, BeaconFlags } from './types';

/**
 * Decode a 20-byte binary buffer into BeaconData
 *
 * @param buffer - Binary packet data
 * @returns Decoded beacon data
 * @throws Error if buffer is invalid
 */
export function decodeBeaconData(buffer: Buffer): BeaconData {
  if (buffer.length !== PACKET_SIZE) {
    throw new Error(`Invalid packet size: expected ${PACKET_SIZE}, got ${buffer.length}`);
  }

  // Device ID (4 bytes) - convert to hex string
  const deviceIdBuffer = buffer.slice(PACKET_OFFSETS.DEVICE_ID, PACKET_OFFSETS.DEVICE_ID + PACKET_SIZES.DEVICE_ID);
  const deviceId = bufferToDeviceId(deviceIdBuffer);

  // Latitude (4 bytes, Float32, big-endian)
  const latitude = buffer.readFloatBE(PACKET_OFFSETS.LATITUDE);

  // Longitude (4 bytes, Float32, big-endian)
  const longitude = buffer.readFloatBE(PACKET_OFFSETS.LONGITUDE);

  // Altitude MSL (2 bytes, Int16, big-endian)
  const altitudeMSL = buffer.readInt16BE(PACKET_OFFSETS.ALTITUDE_MSL);

  // Relative Altitude (2 bytes, Int16, big-endian, in centimeters)
  const relativeAltitude = buffer.readInt16BE(PACKET_OFFSETS.RELATIVE_ALT);

  // Battery (1 byte, 0-100)
  const battery = buffer.readUInt8(PACKET_OFFSETS.BATTERY);

  // Timestamp (2 bytes, Uint16, seconds since boot)
  const timestamp = buffer.readUInt16BE(PACKET_OFFSETS.TIMESTAMP);

  // Flags (1 byte, bit flags)
  const flagsByte = buffer.readUInt8(PACKET_OFFSETS.FLAGS);
  const flags: BeaconFlags = {
    motionDetected: !!(flagsByte & FLAGS.MOTION_DETECTED),
    isCharging: !!(flagsByte & FLAGS.IS_CHARGING),
    sosActivated: !!(flagsByte & FLAGS.SOS_ACTIVATED),
    lowBattery: !!(flagsByte & FLAGS.LOW_BATTERY),
    gpsValid: !!(flagsByte & FLAGS.GPS_VALID),
    stationary: !!(flagsByte & FLAGS.STATIONARY),
  };

  return {
    deviceId,
    latitude,
    longitude,
    altitudeMSL,
    relativeAltitude,
    battery,
    timestamp,
    flags,
  };
}

/**
 * Convert 4-byte buffer to device ID string
 *
 * @param buffer - 4-byte device ID
 * @returns Device ID string (e.g., "0A:2B:3C:4D")
 */
export function bufferToDeviceId(buffer: Buffer): string {
  if (buffer.length !== 4) {
    throw new Error('Device ID must be 4 bytes');
  }
  return Array.from(buffer)
    .map((byte) => byte.toString(16).padStart(2, '0').toUpperCase())
    .join(':');
}

/**
 * Legacy: Convert 6-byte buffer to MAC address string
 * @deprecated Use bufferToDeviceId for new 4-byte format
 */
export function bufferToMacAddress(buffer: Buffer): string {
  if (buffer.length !== 6) {
    throw new Error('Device ID must be 6 bytes');
  }
  return Array.from(buffer)
    .map((byte) => byte.toString(16).padStart(2, '0').toUpperCase())
    .join(':');
}

/**
 * Parse hex string into buffer
 *
 * @param hex - Hex string (with or without colons)
 * @returns Buffer
 */
export function hexToBuffer(hex: string): Buffer {
  const cleanHex = hex.replace(/:/g, '');
  return Buffer.from(cleanHex, 'hex');
}

/**
 * Validate beacon data packet
 *
 * @param buffer - Binary packet
 * @returns true if valid, false otherwise
 */
export function isValidBeaconPacket(buffer: Buffer): boolean {
  if (buffer.length !== PACKET_SIZE) {
    return false;
  }

  try {
    const data = decodeBeaconData(buffer);

    // Validate latitude/longitude ranges
    if (data.latitude < -90 || data.latitude > 90) return false;
    if (data.longitude < -180 || data.longitude > 180) return false;

    // Validate battery range
    if (data.battery < 0 || data.battery > 100) return false;

    // Validate altitude (reasonable range: -500m to 9000m)
    if (data.altitudeMSL < -500 || data.altitudeMSL > 9000) return false;

    return true;
  } catch {
    return false;
  }
}

/**
 * Binary Encoder for Phoenix Emergency Beacon Protocol
 *
 * Encodes sensor data into a compact 22-byte binary packet for BLE transmission
 */

import { PACKET_SIZE, PACKET_OFFSETS, FLAGS } from './constants';
import type { EncoderInput } from './types';

/**
 * Encode beacon data into a 22-byte binary buffer
 *
 * @param input - Sensor data to encode
 * @returns Buffer containing encoded data
 */
export function encodeBeaconData(input: EncoderInput): Buffer {
  const buffer = Buffer.alloc(PACKET_SIZE);

  // Device ID (4 bytes)
  const deviceIdBuffer = typeof input.deviceId === 'string'
    ? Buffer.from(input.deviceId.replace(/:/g, ''), 'hex')
    : input.deviceId;

  // Take only first 4 bytes if longer, or pad with zeros if shorter
  if (deviceIdBuffer.length >= 4) {
    deviceIdBuffer.copy(buffer, PACKET_OFFSETS.DEVICE_ID, 0, 4);
  } else {
    deviceIdBuffer.copy(buffer, PACKET_OFFSETS.DEVICE_ID);
  }

  // Latitude (4 bytes, Float32, big-endian)
  buffer.writeFloatBE(input.latitude, PACKET_OFFSETS.LATITUDE);

  // Longitude (4 bytes, Float32, big-endian)
  buffer.writeFloatBE(input.longitude, PACKET_OFFSETS.LONGITUDE);

  // Altitude MSL (2 bytes, Int16, big-endian)
  buffer.writeInt16BE(Math.round(input.altitudeMSL), PACKET_OFFSETS.ALTITUDE_MSL);

  // Relative Altitude (2 bytes, Int16, big-endian, in centimeters)
  buffer.writeInt16BE(Math.round(input.relativeAltitude), PACKET_OFFSETS.RELATIVE_ALT);

  // Battery (1 byte, 0-100)
  buffer.writeUInt8(Math.min(100, Math.max(0, Math.round(input.battery))), PACKET_OFFSETS.BATTERY);

  // Timestamp (2 bytes, Uint16, seconds since boot)
  buffer.writeUInt16BE(Math.min(65535, Math.round(input.timestamp)), PACKET_OFFSETS.TIMESTAMP);

  // Flags (1 byte, bit flags)
  let flagsByte = 0;
  if (input.motionDetected) flagsByte |= FLAGS.MOTION_DETECTED;
  if (input.isCharging) flagsByte |= FLAGS.IS_CHARGING;
  if (input.sosActivated) flagsByte |= FLAGS.SOS_ACTIVATED;
  if (input.lowBattery) flagsByte |= FLAGS.LOW_BATTERY;
  if (input.gpsValid) flagsByte |= FLAGS.GPS_VALID;
  if (input.stationary) flagsByte |= FLAGS.STATIONARY;
  if (input.fallDetected) flagsByte |= FLAGS.FALL_DETECTED;
  if (input.unstableEnvironment) flagsByte |= FLAGS.UNSTABLE_ENV;

  buffer.writeUInt8(flagsByte, PACKET_OFFSETS.FLAGS);

  return buffer;
}

/**
 * Convert beacon buffer to hex string for debugging
 *
 * @param buffer - Encoded beacon data
 * @returns Hex string representation
 */
export function bufferToHex(buffer: Buffer): string {
  return buffer.toString('hex').toUpperCase();
}

/**
 * Helper: Convert MAC address string to 6-byte buffer
 *
 * @param mac - MAC address (e.g., "AA:BB:CC:DD:EE:FF")
 * @returns 6-byte buffer
 */
export function macToBuffer(mac: string): Buffer {
  const cleanMac = mac.replace(/:/g, '');
  if (cleanMac.length !== 12) {
    throw new Error('Invalid MAC address format');
  }
  return Buffer.from(cleanMac, 'hex');
}

/**
 * Helper: Generate a pseudo-random device ID
 *
 * @returns 4-byte buffer with random device ID (4 billion unique IDs)
 */
export function generateDeviceId(): Buffer {
  const buffer = Buffer.alloc(4);
  for (let i = 0; i < 4; i++) {
    buffer[i] = Math.floor(Math.random() * 256);
  }
  return buffer;
}

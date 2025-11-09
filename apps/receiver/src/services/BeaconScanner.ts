/**
 * BeaconScanner Service
 *
 * Uses native BLEBeaconScanner module to discover Phoenix beacons
 * and decode their sensor data
 */

import { decodeBeaconData, hexToBuffer, type BeaconData } from '@phoenix/beacon-protocol';
import { PermissionsAndroid, Platform } from 'react-native';
import BLEBeaconScanner, { type BeaconDiscoveredEvent } from '../modules/BLEBeaconScanner';
import type { EmitterSubscription } from 'react-native';

export type ScannerStatus = 'idle' | 'starting' | 'scanning' | 'stopping' | 'error';

export interface LocationHistoryPoint {
  latitude: number;
  longitude: number;
  altitude: number;
  timestamp: number;
}

export interface DiscoveredBeacon {
  id: string; // Device ID from beacon packet
  deviceId: string; // BLE device ID
  deviceName: string;
  beaconData: BeaconData | null;
  rssi: number; // Smoothed RSSI value
  rawRssi: number; // Raw/instant RSSI value
  lastSeen: number;
  rawData: string;
  rssiHistory: number[]; // For smoothing
  usingCachedGPS: boolean; // True if using cached GPS from previous valid reading
  locationHistory: LocationHistoryPoint[]; // Track movement over time
}

export interface ScannerState {
  status: ScannerStatus;
  error: string | null;
  beaconsFound: Map<string, DiscoveredBeacon>;
}

export class BeaconScanner {
  private state: ScannerState = {
    status: 'idle',
    error: null,
    beaconsFound: new Map(),
  };
  private stateChangeCallback: ((state: ScannerState) => void) | null = null;
  private beaconDiscoverySubscription: EmitterSubscription | null = null;
  private scanningStateSubscription: EmitterSubscription | null = null;

  constructor() {
    // Set up event listeners for native module
    const discoverySubscription = BLEBeaconScanner.onBeaconDiscovered(
      (event: BeaconDiscoveredEvent) => {
        this.handleBeaconDiscovered(event);
      }
    );
    this.beaconDiscoverySubscription = discoverySubscription;

    const stateSubscription = BLEBeaconScanner.onScanningStateChange(
      (event) => {
        console.log('Scanning state changed:', event);
        if (event.error) {
          this.updateState('error', event.error);
        }
      }
    );
    this.scanningStateSubscription = stateSubscription;
  }

  /**
   * Initialize the beacon scanner
   */
  async initialize(): Promise<void> {
    try {
      // Request permissions
      await this.requestPermissions();

      // Initialize native scanner
      const result = await BLEBeaconScanner.initializeScanner();
      console.log('BLE Scanner initialized:', result);

      // Check Bluetooth state
      if (result.state !== 'poweredOn') {
        throw new Error(`Bluetooth is ${result.state}. Please enable Bluetooth.`);
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

      // Start native scanning
      await BLEBeaconScanner.startScanning();

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

      await BLEBeaconScanner.stopScanning();
      console.log('BLE scan stopped');

      this.updateState('idle');
    } catch (error) {
      console.error('Failed to stop scanning:', error);
      this.updateState('error', `Failed to stop: ${error}`);
      throw error;
    }
  }

  /**
   * Calculate distance between two GPS coordinates (Haversine formula)
   */
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000; // Earth's radius in meters
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in meters
  }

  /**
   * Smooth RSSI using moving average with outlier rejection
   */
  private smoothRSSI(newRssi: number, history: number[]): { smoothed: number; newHistory: number[] } {
    const MAX_HISTORY = 10; // Average over last 10 readings for more stability

    // Add new reading
    const updatedHistory = [...history, newRssi];

    // Keep only last MAX_HISTORY readings
    if (updatedHistory.length > MAX_HISTORY) {
      updatedHistory.shift();
    }

    // Remove outliers using IQR method if we have enough samples
    let filteredHistory = updatedHistory;
    if (updatedHistory.length >= 5) {
      const sorted = [...updatedHistory].sort((a, b) => a - b);
      const q1 = sorted[Math.floor(sorted.length * 0.25)];
      const q3 = sorted[Math.floor(sorted.length * 0.75)];
      const iqr = q3 - q1;
      const lowerBound = q1 - 1.5 * iqr;
      const upperBound = q3 + 1.5 * iqr;

      // Filter out outliers
      filteredHistory = updatedHistory.filter(val => val >= lowerBound && val <= upperBound);

      // If we filtered too many values, use all values
      if (filteredHistory.length < 3) {
        filteredHistory = updatedHistory;
      }
    }

    // Calculate weighted average (more recent = more weight)
    let weightedSum = 0;
    let weightSum = 0;
    filteredHistory.forEach((val, index) => {
      const weight = index + 1; // Linear weighting: 1, 2, 3, ...
      weightedSum += val * weight;
      weightSum += weight;
    });

    const smoothed = Math.round(weightedSum / weightSum);

    return { smoothed, newHistory: updatedHistory };
  }

  /**
   * Handle a discovered beacon from native module
   */
  private handleBeaconDiscovered(event: BeaconDiscoveredEvent): void {
    try {
      console.log('\n========================================');
      console.log('*** PHOENIX BEACON DETECTED ***');
      console.log('========================================');
      console.log(`Device: ${event.deviceName} (${event.deviceId})`);
      console.log(`Raw RSSI: ${event.rssi} dBm`);
      console.log(`Beacon Data: ${event.beaconData}`);

      // Convert hex string to buffer
      const beaconDataBuffer = hexToBuffer(event.beaconData);

      // Decode beacon data
      const beaconData = decodeBeaconData(beaconDataBuffer);

      console.log(`Beacon ID: ${beaconData.deviceId}`);
      console.log(`Location: (${beaconData.latitude.toFixed(6)}, ${beaconData.longitude.toFixed(6)})`);
      console.log(`Battery: ${beaconData.battery}%`);
      console.log(`GPS Valid: ${beaconData.flags.gpsValid}`);
      console.log(`Motion Detected: ${beaconData.flags.motionDetected}`);

      // Get existing beacon for RSSI smoothing and location history
      const existingBeacon = this.state.beaconsFound.get(beaconData.deviceId);
      const rssiHistory = existingBeacon?.rssiHistory || [];
      const locationHistory = existingBeacon?.locationHistory || [];

      // Smooth RSSI
      const { smoothed, newHistory } = this.smoothRSSI(event.rssi, rssiHistory);

      // Update location history if GPS is valid and position changed
      const MAX_HISTORY = 10;
      let updatedLocationHistory = [...locationHistory];
      if (beaconData.flags.gpsValid) {
        // Only add if position changed by > 5 meters or it's the first entry
        const lastPoint = updatedLocationHistory[updatedLocationHistory.length - 1];
        const shouldAdd = !lastPoint || this.calculateDistance(
          lastPoint.latitude,
          lastPoint.longitude,
          beaconData.latitude,
          beaconData.longitude
        ) > 5; // 5 meters threshold

        if (shouldAdd) {
          updatedLocationHistory.push({
            latitude: beaconData.latitude,
            longitude: beaconData.longitude,
            altitude: beaconData.altitudeMSL,
            timestamp: event.timestamp,
          });

          // Keep only last 10 points
          if (updatedLocationHistory.length > MAX_HISTORY) {
            updatedLocationHistory.shift();
          }

          console.log(`Location history updated: ${updatedLocationHistory.length} points`);
        }
      }

      console.log(`Smoothed RSSI: ${smoothed} dBm (from ${newHistory.length} samples)`);

      // Preserve last known GPS coordinates if current GPS is invalid
      let finalBeaconData = beaconData;
      let usingCachedGPS = false;

      if (!beaconData.flags.gpsValid && existingBeacon?.beaconData?.flags.gpsValid) {
        console.log('⚠️ GPS signal lost - retaining last known coordinates');
        console.log(`Last known: (${existingBeacon.beaconData.latitude.toFixed(6)}, ${existingBeacon.beaconData.longitude.toFixed(6)})`);

        // Keep last known GPS coordinates but update other data
        finalBeaconData = {
          ...beaconData,
          latitude: existingBeacon.beaconData.latitude,
          longitude: existingBeacon.beaconData.longitude,
          altitudeMSL: existingBeacon.beaconData.altitudeMSL,
        };
        usingCachedGPS = true;
      }

      console.log('========================================\n');

      // Create/update beacon entry
      const beacon: DiscoveredBeacon = {
        id: beaconData.deviceId,
        deviceId: event.deviceId,
        deviceName: event.deviceName,
        beaconData: finalBeaconData,
        rssi: smoothed,
        rawRssi: event.rssi,
        lastSeen: event.timestamp,
        rawData: event.beaconData,
        rssiHistory: newHistory,
        usingCachedGPS,
        locationHistory: updatedLocationHistory,
      };

      // Update or add beacon
      this.state.beaconsFound.set(beaconData.deviceId, beacon);
      this.notifyStateChange();

      console.log(`Total Phoenix beacons found: ${this.state.beaconsFound.size}`);
    } catch (error) {
      console.error('Failed to decode beacon data:', error);
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
   * Clear old beacons (not seen in last 60 seconds)
   * Extended from 30s to 60s to accommodate GPS fallback mode
   */
  clearStaleBeacons(): void {
    const now = Date.now();
    const staleThreshold = 60000; // 60 seconds (allows for GPS fallback)

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

    // Clean up event listeners
    if (this.beaconDiscoverySubscription) {
      this.beaconDiscoverySubscription.remove();
    }

    if (this.scanningStateSubscription) {
      this.scanningStateSubscription.remove();
    }
  }
}

import { useState, useEffect, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import { ScrollView, View, StyleSheet, RefreshControl, Text as RNText, TouchableOpacity } from 'react-native';
import { APP_NAME } from '@phoenix/utils';
import { BeaconScanner, type DiscoveredBeacon, type ScannerState } from './src/services/BeaconScanner';

export default function App() {
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [scannerState, setScannerState] = useState<ScannerState | null>(null);
  const [beacons, setBeacons] = useState<DiscoveredBeacon[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState<boolean>(false);
  const [bluetoothReady, setBluetoothReady] = useState<boolean>(false);
  const scannerRef = useRef<BeaconScanner | null>(null);

  useEffect(() => {
    requestPermissions();

    return () => {
      if (scannerRef.current) {
        scannerRef.current.destroy();
      }
    };
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    if (isScanning) {
      interval = setInterval(() => {
        if (scannerRef.current) {
          scannerRef.current.clearStaleBeacons();
          const currentBeacons = scannerRef.current.getBeacons();
          setBeacons(currentBeacons);
        }
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isScanning]);

  const requestPermissions = async () => {
    try {
      setError('');
      const scanner = new BeaconScanner();

      await scanner.initialize();

      setPermissionGranted(true);
      setBluetoothReady(true);

      scanner.onStateChange((state) => {
        setScannerState(state);
        if (state.error) {
          setError(state.error);
        }
        setBeacons(scanner.getBeacons());
      });

      scannerRef.current = scanner;
    } catch (error) {
      console.error('Failed to request permissions:', error);
      setError(`Permissions required: ${error}`);
      setPermissionGranted(false);
      setBluetoothReady(false);
    }
  };

  const startScanning = async () => {
    try {
      setError('');

      if (!scannerRef.current) {
        throw new Error('Beacon scanner not initialized');
      }

      await scannerRef.current.startScanning();
      setIsScanning(true);
    } catch (error) {
      console.error('Error starting scan:', error);
      setError(`Error: ${error}`);
    }
  };

  const stopScanning = async () => {
    try {
      if (!scannerRef.current) {
        return;
      }

      await scannerRef.current.stopScanning();
      setIsScanning(false);
    } catch (error) {
      console.error('Error stopping scan:', error);
      setError(`Error: ${error}`);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    if (scannerRef.current) {
      const currentBeacons = scannerRef.current.getBeacons();
      setBeacons(currentBeacons);
    }
    setTimeout(() => setRefreshing(false), 500);
  };

  const formatTimeSince = (timestamp: number): string => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 5) return 'just now';
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m ago`;
  };

  const getSignalStrength = (rssi: number): string => {
    if (rssi >= -60) return 'Excellent';
    if (rssi >= -70) return 'Good';
    if (rssi >= -80) return 'Fair';
    return 'Weak';
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <RNText style={styles.title}>{APP_NAME} Receiver</RNText>
        <RNText style={styles.subtitle}>BLE Beacon Scanner (Dev Mode)</RNText>

        {!permissionGranted || !bluetoothReady ? (
          <View style={styles.warningBox}>
            <RNText style={styles.warningText}>
              {!permissionGranted
                ? 'Bluetooth and Location permissions are required for scanning.'
                : 'Bluetooth is not enabled. Please enable Bluetooth.'}
            </RNText>
            <TouchableOpacity style={styles.button} onPress={requestPermissions}>
              <RNText style={styles.buttonText}>Request Permissions</RNText>
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={styles.controlSection}>
          <TouchableOpacity
            style={[
              styles.button,
              isScanning && styles.secondaryButton,
              (!permissionGranted || !bluetoothReady) && styles.disabledButton,
            ]}
            onPress={isScanning ? stopScanning : startScanning}
            disabled={!permissionGranted || !bluetoothReady}
          >
            <RNText style={styles.buttonText}>
              {isScanning ? 'Stop Scanning' : 'Start Scanning'}
            </RNText>
          </TouchableOpacity>

          <View style={[styles.statusIndicator, isScanning && styles.statusActive]}>
            <RNText style={styles.statusText}>
              {isScanning ? 'SCANNING' : 'IDLE'}
            </RNText>
          </View>
        </View>

        {error ? (
          <View style={styles.errorBox}>
            <RNText style={styles.errorText}>{error}</RNText>
          </View>
        ) : null}

        {scannerState && (
          <View style={styles.statsSection}>
            <RNText style={styles.sectionTitle}>Scanner Stats</RNText>
            <View style={styles.dataCard}>
              <RNText style={styles.dataText}>Status: {scannerState.status.toUpperCase()}</RNText>
              <RNText style={styles.dataText}>Beacons found: {scannerState.beaconsFound.size}</RNText>
            </View>
          </View>
        )}

        {beacons.length > 0 ? (
          <View style={styles.beaconsSection}>
            <RNText style={styles.sectionTitle}>Discovered Beacons ({beacons.length})</RNText>

            {beacons.map((beacon) => (
              <View key={beacon.id} style={styles.beaconCard}>
                <View style={styles.beaconHeader}>
                  <RNText style={styles.beaconId}>{beacon.id}</RNText>
                  <RNText style={styles.lastSeen}>{formatTimeSince(beacon.lastSeen)}</RNText>
                </View>

                <View style={styles.signalInfo}>
                  <RNText style={styles.dataText}>
                    Signal: {getSignalStrength(beacon.rssi)} ({beacon.rssi} dBm)
                  </RNText>
                </View>

                {beacon.beaconData ? (
                  <>
                    <View style={styles.separator} />

                    <RNText style={styles.sectionLabel}>Location</RNText>
                    <RNText style={styles.dataText}>Lat: {beacon.beaconData.latitude.toFixed(6)}</RNText>
                    <RNText style={styles.dataText}>Lon: {beacon.beaconData.longitude.toFixed(6)}</RNText>
                    <RNText style={styles.dataText}>Alt MSL: {beacon.beaconData.altitudeMSL}m</RNText>
                    <RNText style={styles.dataText}>Rel Alt: {beacon.beaconData.relativeAltitude}cm</RNText>

                    <View style={styles.separator} />
                    <RNText style={styles.sectionLabel}>Status</RNText>
                    <RNText style={styles.dataText}>Battery: {beacon.beaconData.battery}%</RNText>
                    <RNText style={styles.dataText}>Timestamp: {beacon.beaconData.timestamp}s</RNText>

                    <View style={styles.separator} />
                    <RNText style={styles.sectionLabel}>Flags</RNText>
                    <View style={styles.flagsRow}>
                      <View style={[styles.flag, beacon.beaconData.flags.gpsValid && styles.flagActive]}>
                        <RNText style={styles.flagText}>
                          GPS: {beacon.beaconData.flags.gpsValid ? 'Yes' : 'No'}
                        </RNText>
                      </View>
                      <View style={[styles.flag, beacon.beaconData.flags.motionDetected && styles.flagActive]}>
                        <RNText style={styles.flagText}>
                          Motion: {beacon.beaconData.flags.motionDetected ? 'Yes' : 'No'}
                        </RNText>
                      </View>
                      <View style={[styles.flag, beacon.beaconData.flags.lowBattery && styles.flagWarn]}>
                        <RNText style={styles.flagText}>
                          Low Battery: {beacon.beaconData.flags.lowBattery ? 'Yes' : 'No'}
                        </RNText>
                      </View>
                      <View style={[styles.flag, beacon.beaconData.flags.sos && styles.flagCritical]}>
                        <RNText style={styles.flagText}>
                          SOS: {beacon.beaconData.flags.sos ? 'Yes' : 'No'}
                        </RNText>
                      </View>
                    </View>

                    <View style={styles.separator} />
                    <RNText style={styles.sectionLabel}>Raw Manufacturer Data</RNText>
                    <RNText style={styles.rawData}>{beacon.rawData}</RNText>
                  </>
                ) : (
                  <RNText style={styles.noData}>Failed to decode beacon data</RNText>
                )}
              </View>
            ))}
          </View>
        ) : isScanning ? (
          <View style={styles.emptyState}>
            <RNText style={styles.emptyText}>Scanning for beacons...</RNText>
            <RNText style={styles.emptySubtext}>Make sure the emitter app is broadcasting</RNText>
          </View>
        ) : (
          <View style={styles.emptyState}>
            <RNText style={styles.emptyText}>Ready to scan</RNText>
            <RNText style={styles.emptySubtext}>Tap "Start Scanning" to begin</RNText>
          </View>
        )}
      </ScrollView>

      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 20,
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 20,
    color: '#666',
  },
  warningBox: {
    backgroundColor: '#FFF3CD',
    padding: 16,
    borderRadius: 8,
    marginBottom: 20,
  },
  warningText: {
    color: '#856404',
    marginBottom: 12,
  },
  controlSection: {
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
  },
  secondaryButton: {
    backgroundColor: '#6c757d',
  },
  disabledButton: {
    backgroundColor: '#CCCCCC',
    opacity: 0.6,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  statusIndicator: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#F0F0F0',
    borderRadius: 8,
    alignItems: 'center',
  },
  statusActive: {
    backgroundColor: '#E3F2FD',
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
  },
  errorBox: {
    backgroundColor: '#F8D7DA',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
  },
  errorText: {
    color: '#721C24',
  },
  statsSection: {
    marginBottom: 20,
  },
  beaconsSection: {
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  dataCard: {
    backgroundColor: '#F8F9FA',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
  },
  beaconCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  beaconHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  beaconId: {
    fontSize: 16,
    fontWeight: '700',
    color: '#007AFF',
    fontFamily: 'monospace',
  },
  lastSeen: {
    fontSize: 12,
    color: '#999',
  },
  signalInfo: {
    marginBottom: 8,
  },
  separator: {
    height: 1,
    backgroundColor: '#E0E0E0',
    marginVertical: 12,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  dataText: {
    fontSize: 14,
    marginVertical: 2,
    color: '#333',
  },
  flagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  flag: {
    backgroundColor: '#F0F0F0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  flagActive: {
    backgroundColor: '#D4EDDA',
  },
  flagWarn: {
    backgroundColor: '#FFF3CD',
  },
  flagCritical: {
    backgroundColor: '#F8D7DA',
  },
  flagText: {
    fontSize: 12,
    fontWeight: '600',
  },
  rawData: {
    fontSize: 11,
    fontFamily: 'monospace',
    color: '#666',
    backgroundColor: '#F5F5F5',
    padding: 8,
    borderRadius: 4,
    marginTop: 4,
  },
  noData: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 12,
  },
  emptyState: {
    marginTop: 40,
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 18,
    color: '#666',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
  },
});

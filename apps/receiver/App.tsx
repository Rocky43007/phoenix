import { useState, useEffect, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import { ScrollView, View, StyleSheet, RefreshControl } from 'react-native';
import { Container, Text, Button } from '@phoenix/ui';
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
      // Cleanup scanner on unmount
      if (scannerRef.current) {
        scannerRef.current.destroy();
      }
    };
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    if (isScanning) {
      // Update beacon list every 1 second and clean stale beacons
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

      // Request permissions
      await scanner.initialize();

      setPermissionGranted(true);
      setBluetoothReady(true);

      scanner.onStateChange((state) => {
        setScannerState(state);
        if (state.error) {
          setError(state.error);
        }
        // Update beacons list
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
    <Container>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <Text variant="title" style={styles.title}>{APP_NAME} Receiver</Text>
        <Text variant="body" style={styles.subtitle}>
          BLE Beacon Scanner (Dev Mode)
        </Text>

        {!permissionGranted || !bluetoothReady ? (
          <View style={styles.warningBox}>
            <Text variant="caption" style={styles.warningText}>
              {!permissionGranted
                ? 'Bluetooth and Location permissions are required for scanning.'
                : 'Bluetooth is not enabled. Please enable Bluetooth.'}
            </Text>
            <Button
              title="Request Permissions"
              onPress={requestPermissions}
              variant="primary"
            />
          </View>
        ) : null}

        <View style={styles.controlSection}>
          <Button
            title={isScanning ? "Stop Scanning" : "Start Scanning"}
            onPress={isScanning ? stopScanning : startScanning}
            variant={isScanning ? "secondary" : "primary"}
            disabled={!permissionGranted || !bluetoothReady}
          />

          <View style={[styles.statusIndicator, isScanning && styles.statusActive]}>
            <Text variant="caption" style={styles.statusText}>
              {isScanning ? 'SCANNING' : 'IDLE'}
            </Text>
          </View>
        </View>

        {error ? (
          <View style={styles.errorBox}>
            <Text variant="caption" style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {scannerState && (
          <View style={styles.statsSection}>
            <Text variant="body" style={styles.sectionTitle}>Scanner Stats</Text>
            <View style={styles.dataCard}>
              <Text variant="caption" style={styles.dataText}>
                Status: {scannerState.status.toUpperCase()}
              </Text>
              <Text variant="caption" style={styles.dataText}>
                Beacons found: {scannerState.beaconsFound.size}
              </Text>
            </View>
          </View>
        )}

        {beacons.length > 0 ? (
          <View style={styles.beaconsSection}>
            <Text variant="body" style={styles.sectionTitle}>
              Discovered Beacons ({beacons.length})
            </Text>

            {beacons.map((beacon) => (
              <View key={beacon.id} style={styles.beaconCard}>
                <View style={styles.beaconHeader}>
                  <Text variant="body" style={styles.beaconId}>
                    {beacon.id}
                  </Text>
                  <Text variant="caption" style={styles.lastSeen}>
                    {formatTimeSince(beacon.lastSeen)}
                  </Text>
                </View>

                <View style={styles.signalInfo}>
                  <Text variant="caption" style={styles.dataText}>
                    Signal: {getSignalStrength(beacon.rssi)} ({beacon.rssi} dBm)
                  </Text>
                </View>

                {beacon.beaconData ? (
                  <>
                    <View style={styles.separator} />

                    {/* Location */}
                    <Text variant="caption" style={styles.sectionLabel}>
                      Location
                    </Text>
                    <Text variant="caption" style={styles.dataText}>
                      Lat: {beacon.beaconData.latitude.toFixed(6)}
                    </Text>
                    <Text variant="caption" style={styles.dataText}>
                      Lon: {beacon.beaconData.longitude.toFixed(6)}
                    </Text>
                    <Text variant="caption" style={styles.dataText}>
                      Alt MSL: {beacon.beaconData.altitudeMSL}m
                    </Text>
                    <Text variant="caption" style={styles.dataText}>
                      Rel Alt: {beacon.beaconData.relativeAltitude}cm
                    </Text>

                    {/* Status */}
                    <View style={styles.separator} />
                    <Text variant="caption" style={styles.sectionLabel}>
                      Status
                    </Text>
                    <Text variant="caption" style={styles.dataText}>
                      Battery: {beacon.beaconData.battery}%
                    </Text>
                    <Text variant="caption" style={styles.dataText}>
                      Timestamp: {beacon.beaconData.timestamp}s
                    </Text>

                    {/* Flags */}
                    <View style={styles.separator} />
                    <Text variant="caption" style={styles.sectionLabel}>
                      Flags
                    </Text>
                    <View style={styles.flagsRow}>
                      <View style={[styles.flag, beacon.beaconData.flags.gpsValid && styles.flagActive]}>
                        <Text variant="caption" style={styles.flagText}>
                          GPS: {beacon.beaconData.flags.gpsValid ? 'Yes' : 'No'}
                        </Text>
                      </View>
                      <View style={[styles.flag, beacon.beaconData.flags.motionDetected && styles.flagActive]}>
                        <Text variant="caption" style={styles.flagText}>
                          Motion: {beacon.beaconData.flags.motionDetected ? 'Yes' : 'No'}
                        </Text>
                      </View>
                      <View style={[styles.flag, beacon.beaconData.flags.lowBattery && styles.flagWarn]}>
                        <Text variant="caption" style={styles.flagText}>
                          Low Battery: {beacon.beaconData.flags.lowBattery ? 'Yes' : 'No'}
                        </Text>
                      </View>
                      <View style={[styles.flag, beacon.beaconData.flags.sos && styles.flagCritical]}>
                        <Text variant="caption" style={styles.flagText}>
                          SOS: {beacon.beaconData.flags.sos ? 'Yes' : 'No'}
                        </Text>
                      </View>
                    </View>

                    {/* Raw Data */}
                    <View style={styles.separator} />
                    <Text variant="caption" style={styles.sectionLabel}>
                      Raw Manufacturer Data
                    </Text>
                    <Text variant="caption" style={styles.rawData}>
                      {beacon.rawData}
                    </Text>
                  </>
                ) : (
                  <Text variant="caption" style={styles.noData}>
                    Failed to decode beacon data
                  </Text>
                )}
              </View>
            ))}
          </View>
        ) : isScanning ? (
          <View style={styles.emptyState}>
            <Text variant="body" style={styles.emptyText}>
              Scanning for beacons...
            </Text>
            <Text variant="caption" style={styles.emptySubtext}>
              Make sure the emitter app is broadcasting
            </Text>
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Text variant="body" style={styles.emptyText}>
              Ready to scan
            </Text>
            <Text variant="caption" style={styles.emptySubtext}>
              Tap "Start Scanning" to begin
            </Text>
          </View>
        )}
      </ScrollView>

      <StatusBar style="auto" />
    </Container>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  title: {
    textAlign: 'center',
    marginTop: 20,
  },
  subtitle: {
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

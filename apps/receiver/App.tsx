import { useState, useEffect, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import { ScrollView, View, StyleSheet, RefreshControl, Text as RNText, TouchableOpacity } from 'react-native';
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context';
import { APP_NAME } from '@phoenix/utils';
import { BeaconScanner, type DiscoveredBeacon, type ScannerState } from './src/services/BeaconScanner';
import NativeLogger from './src/modules/NativeLogger';
import { PrecisionFindingView } from './src/components/PrecisionFindingView';

function AppContent() {
  // Initialize native logger to forward native logs to Metro console
  useEffect(() => {
    NativeLogger.startLogging();
    return () => {
      NativeLogger.stopLogging();
    };
  }, []);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [scannerState, setScannerState] = useState<ScannerState | null>(null);
  const [beacons, setBeacons] = useState<DiscoveredBeacon[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState<boolean>(false);
  const [bluetoothReady, setBluetoothReady] = useState<boolean>(false);
  const [selectedBeacon, setSelectedBeacon] = useState<DiscoveredBeacon | null>(null);
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
      // Update every 250ms - responsive updates with acceptable battery drain
      // 250ms = 4 updates/sec - smooth experience for precision finding
      interval = setInterval(() => {
        if (scannerRef.current) {
          scannerRef.current.clearStaleBeacons();
          const currentBeacons = scannerRef.current.getBeacons();
          setBeacons(currentBeacons);

          // Update selected beacon if it's still in the list
          if (selectedBeacon) {
            const updatedBeacon = currentBeacons.find(b => b.id === selectedBeacon.id);
            if (updatedBeacon) {
              setSelectedBeacon(updatedBeacon);
            }
            // Don't kick out the user if beacon disappears - let PrecisionFindingView handle it
          }
        }
      }, 250); // 4 updates per second - smooth and responsive
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isScanning, selectedBeacon]);

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

  // Show precision finding view if a beacon is selected
  if (selectedBeacon) {
    return (
      <SafeAreaView style={styles.precisionContainer} edges={['top', 'left', 'right']}>
        <View style={styles.precisionContent}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => setSelectedBeacon(null)}
          >
            <RNText style={styles.backButtonText}>←</RNText>
          </TouchableOpacity>
          <PrecisionFindingView beacon={selectedBeacon} />
        </View>
        <StatusBar style="light" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
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

        {beacons.length > 0 && (
          <View style={styles.statsCard}>
            <RNText style={styles.statsTitle}>Quick Stats</RNText>
            <View style={styles.statsGrid}>
              <View style={styles.statItem}>
                <RNText style={styles.statValue}>{beacons.length}</RNText>
                <RNText style={styles.statLabel}>Beacons</RNText>
              </View>
              <View style={styles.statItem}>
                <RNText style={styles.statValue}>
                  {beacons.filter(b => b.beaconData?.flags.sosActivated || b.beaconData?.flags.fallDetected).length}
                </RNText>
                <RNText style={styles.statLabel}>Priority</RNText>
              </View>
              <View style={styles.statItem}>
                <RNText style={styles.statValue}>
                  {beacons.filter(b => b.beaconData?.flags.gpsValid).length}
                </RNText>
                <RNText style={styles.statLabel}>GPS Lock</RNText>
              </View>
              <View style={styles.statItem}>
                <RNText style={styles.statValue}>
                  {beacons.filter(b => b.beaconData?.flags.lowBattery).length}
                </RNText>
                <RNText style={styles.statLabel}>Low Battery</RNText>
              </View>
            </View>
          </View>
        )}

        {beacons.length > 0 ? (
          <View style={styles.beaconsSection}>
            <RNText style={styles.sectionTitle}>Discovered Beacons ({beacons.length})</RNText>

            {beacons.map((beacon) => (
              <TouchableOpacity
                key={beacon.id}
                style={styles.beaconCard}
                onPress={() => setSelectedBeacon(beacon)}
              >
                <View style={styles.beaconHeader}>
                  <RNText style={styles.beaconId}>{beacon.deviceName}</RNText>
                  <RNText style={styles.lastSeen}>{formatTimeSince(beacon.lastSeen)}</RNText>
                </View>

                {/* Priority Alerts in list */}
                {beacon.beaconData && (beacon.beaconData.flags.fallDetected || beacon.beaconData.flags.unstableEnvironment || beacon.beaconData.flags.sosActivated) && (
                  <View style={styles.priorityAlertsRow}>
                    {beacon.beaconData.flags.sosActivated && (
                      <View style={[styles.priorityBadge, styles.priorityCritical]}>
                        <RNText style={styles.priorityBadgeText}>SOS</RNText>
                      </View>
                    )}
                    {beacon.beaconData.flags.fallDetected && (
                      <View style={[styles.priorityBadge, styles.priorityUrgent]}>
                        <RNText style={styles.priorityBadgeText}>Fall</RNText>
                      </View>
                    )}
                    {beacon.beaconData.flags.unstableEnvironment && (
                      <View style={[styles.priorityBadge, styles.priorityWarning]}>
                        <RNText style={styles.priorityBadgeText}>Unstable</RNText>
                      </View>
                    )}
                  </View>
                )}

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
                      <View style={[styles.flag, beacon.beaconData.flags.sosActivated && styles.flagCritical]}>
                        <RNText style={styles.flagText}>
                          SOS: {beacon.beaconData.flags.sosActivated ? 'Yes' : 'No'}
                        </RNText>
                      </View>
                      <View style={[styles.flag, beacon.beaconData.flags.fallDetected && styles.flagCritical]}>
                        <RNText style={styles.flagText}>
                          Fall: {beacon.beaconData.flags.fallDetected ? 'Yes' : 'No'}
                        </RNText>
                      </View>
                      <View style={[styles.flag, beacon.beaconData.flags.unstableEnvironment && styles.flagWarn]}>
                        <RNText style={styles.flagText}>
                          Unstable: {beacon.beaconData.flags.unstableEnvironment ? 'Yes' : 'No'}
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

                {/* Tap to view hint */}
                <View style={styles.tapHint}>
                  <RNText style={styles.tapHintText}>Tap for Precision Finding</RNText>
                </View>
              </TouchableOpacity>
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

      <StatusBar style="light" />
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppContent />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000', // Dark theme
  },
  precisionContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  precisionContent: {
    flex: 1,
    position: 'relative',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 10,
    color: '#FFF',
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 20,
    color: '#999',
  },
  warningBox: {
    backgroundColor: 'rgba(255, 159, 10, 0.2)',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#FF9F0A',
  },
  warningText: {
    color: '#FF9F0A',
    marginBottom: 12,
    fontSize: 14,
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
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    alignItems: 'center',
  },
  statusActive: {
    backgroundColor: 'rgba(52, 199, 89, 0.2)',
    borderWidth: 1,
    borderColor: '#34C759',
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
  },
  errorBox: {
    backgroundColor: 'rgba(255, 59, 48, 0.2)',
    padding: 12,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#FF3B30',
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 14,
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
    color: '#FFF',
  },
  dataCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  beaconCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    shadowColor: '#FFF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
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
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginVertical: 12,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#999',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dataText: {
    fontSize: 14,
    marginVertical: 2,
    color: '#FFF',
  },
  flagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  flag: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  flagActive: {
    backgroundColor: 'rgba(52, 199, 89, 0.2)',
    borderColor: '#34C759',
  },
  flagWarn: {
    backgroundColor: 'rgba(255, 159, 10, 0.2)',
    borderColor: '#FF9F0A',
  },
  flagCritical: {
    backgroundColor: 'rgba(255, 59, 48, 0.2)',
    borderColor: '#FF3B30',
  },
  flagText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFF',
  },
  rawData: {
    fontSize: 11,
    fontFamily: 'monospace',
    color: '#999',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    padding: 8,
    borderRadius: 4,
    marginTop: 4,
  },
  noData: {
    fontSize: 14,
    color: '#666',
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
    color: '#999',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666',
  },
  backButton: {
    position: 'absolute',
    top: 20,
    left: 20,
    zIndex: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  backButtonText: {
    color: '#FFF',
    fontSize: 24,
    fontWeight: '600',
  },
  tapHint: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
  },
  tapHintText: {
    fontSize: 13,
    color: '#007AFF',
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  priorityAlertsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginVertical: 8,
  },
  priorityBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  priorityCritical: {
    backgroundColor: 'rgba(255, 59, 48, 0.2)',
    borderColor: '#FF3B30',
  },
  priorityUrgent: {
    backgroundColor: 'rgba(255, 159, 10, 0.2)',
    borderColor: '#FF9F0A',
  },
  priorityWarning: {
    backgroundColor: 'rgba(255, 204, 0, 0.2)',
    borderColor: '#FFCC00',
  },
  priorityBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statsCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  statsTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
    color: '#FFF',
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#007AFF',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 11,
    color: '#999',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});

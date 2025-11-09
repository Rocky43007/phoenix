import { useState, useEffect, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import { ScrollView, View, StyleSheet, Text as RNText, TouchableOpacity } from 'react-native';
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context';
import { APP_NAME } from '@phoenix/utils';
import SensorDataModule, { AllSensorData } from './src/modules/SensorDataModule';
import { BeaconTransmitter, TransmitterState } from './src/services/BeaconTransmitter';
import NativeLogger from './src/modules/NativeLogger';

function AppContent() {
  const [sensorData, setSensorData] = useState<AllSensorData | null>(null);
  const [isEmitting, setIsEmitting] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [permissionGranted, setPermissionGranted] = useState<boolean>(false);
  const [transmitterState, setTransmitterState] = useState<TransmitterState | null>(null);
  const transmitterRef = useRef<BeaconTransmitter | null>(null);

  useEffect(() => {
    // Initialize native logging to Metro console
    NativeLogger.startLogging();

    requestPermissions();
    initializeTransmitter();

    return () => {
      // Cleanup transmitter on unmount
      if (transmitterRef.current) {
        transmitterRef.current.destroy();
      }
      // Stop native logging
      NativeLogger.stopLogging();
    };
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    if (isEmitting) {
      // Update sensor data every 1 second
      interval = setInterval(() => {
        updateSensorData();
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isEmitting]);

  const initializeTransmitter = async () => {
    try {
      const transmitter = new BeaconTransmitter();
      transmitter.onStateChange((state) => {
        setTransmitterState(state);
        if (state.error) {
          setError(state.error);
        }
      });
      await transmitter.initialize();
      transmitterRef.current = transmitter;
    } catch (error) {
      console.error('Failed to initialize transmitter:', error);
      setError(`Transmitter init failed: ${error}`);
    }
  };

  const requestPermissions = async () => {
    try {
      const result = await SensorDataModule.requestLocationPermission();

      if (result.status === 'authorized') {
        setPermissionGranted(true);
      } else if (result.status === 'requested') {
        // Permission dialog was shown, check again after user responds
        // iOS doesn't provide a callback, so we poll for the result
        setTimeout(async () => {
          const checkResult = await SensorDataModule.requestLocationPermission();
          if (checkResult.status === 'authorized') {
            setPermissionGranted(true);
          } else if (checkResult.status === 'denied') {
            setError('Location permission denied. Please enable in Settings.');
          }
        }, 500);
      } else if (result.status === 'denied') {
        setError('Location permission denied. Please enable in Settings.');
      }
    } catch (error) {
      console.error('Error requesting permissions:', error);
      setError('Failed to request permissions');
    }
  };

  const startEmitting = async () => {
    try {
      setError('');

      if (!transmitterRef.current) {
        throw new Error('Beacon transmitter not initialized');
      }

      // Start beacon transmission (handles sensor startup internally)
      await transmitterRef.current.startAdvertising();

      setIsEmitting(true);

      // Get initial sensor data for UI display
      await updateSensorData();
    } catch (error) {
      console.error('Error starting emission:', error);
      setError(`Error: ${error}`);
    }
  };

  const stopEmitting = async () => {
    try {
      if (!transmitterRef.current) {
        return;
      }

      await transmitterRef.current.stopAdvertising();
      setIsEmitting(false);
    } catch (error) {
      console.error('Error stopping emission:', error);
      setError(`Error: ${error}`);
    }
  };

  const updateSensorData = async () => {
    try {
      const data = await SensorDataModule.getAllSensorData();
      setSensorData(data);
    } catch (error) {
      console.error('Error fetching sensor data:', error);
    }
  };

  const formatBatteryLevel = (level: number): string => {
    if (level < 0) return 'N/A';
    return `${Math.round(level * 100)}%`;
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <RNText style={styles.title}>{APP_NAME} Emitter</RNText>
        <RNText style={styles.subtitle}>
          Emergency Beacon System
        </RNText>

        <View style={styles.controlSection}>
          <TouchableOpacity
            style={[
              styles.button,
              isEmitting && styles.secondaryButton,
            ]}
            onPress={isEmitting ? stopEmitting : startEmitting}
          >
            <RNText style={styles.buttonText}>
              {isEmitting ? "Stop Broadcasting" : "Start Broadcasting"}
            </RNText>
          </TouchableOpacity>

          <View style={[styles.statusIndicator, isEmitting && styles.statusActive]}>
            <RNText style={styles.statusText}>
              {isEmitting ? 'ACTIVE' : 'INACTIVE'}
            </RNText>
          </View>
        </View>

        {error ? (
          <View style={styles.errorBox}>
            <RNText style={styles.errorText}>{error}</RNText>
          </View>
        ) : null}

        {transmitterState && (
          <View style={styles.beaconStatus}>
            <RNText style={styles.sectionTitle}>Beacon Transmission</RNText>
            <View style={styles.dataCard}>
              <RNText style={styles.dataText}>
                Status: {transmitterState.status.toUpperCase()}
              </RNText>
              <RNText style={styles.dataText}>
                Packets sent: {transmitterState.transmissionCount}
              </RNText>
              {transmitterState.lastTransmission && (
                <RNText style={styles.dataText}>
                  Last transmission: {new Date(transmitterState.lastTransmission).toLocaleTimeString()}
                </RNText>
              )}
            </View>
          </View>
        )}

        {sensorData && (
          <View style={styles.dataSection}>
            <RNText style={styles.sectionTitle}>Sensor Data</RNText>

            {/* Location Data */}
            <View style={styles.dataCard}>
              <RNText style={styles.cardTitle}>Location</RNText>
              {sensorData.location ? (
                <>
                  <RNText style={styles.dataText}>
                    Lat: {sensorData.location.latitude.toFixed(6)}
                  </RNText>
                  <RNText style={styles.dataText}>
                    Lon: {sensorData.location.longitude.toFixed(6)}
                  </RNText>
                  <RNText style={styles.dataText}>
                    Alt: {sensorData.location.altitude.toFixed(1)}m
                  </RNText>
                  <RNText style={styles.dataText}>
                    Accuracy: ±{sensorData.location.accuracy.toFixed(1)}m
                  </RNText>
                  <RNText style={styles.dataText}>
                    Speed: {sensorData.location.speed.toFixed(1)} m/s
                  </RNText>
                </>
              ) : (
                <RNText style={styles.noData}>No location data</RNText>
              )}
            </View>

            {/* Accelerometer Data */}
            <View style={styles.dataCard}>
              <RNText style={styles.cardTitle}>Accelerometer</RNText>
              {sensorData.accelerometer ? (
                <>
                  <RNText style={styles.dataText}>
                    X: {sensorData.accelerometer.x.toFixed(3)} g
                  </RNText>
                  <RNText style={styles.dataText}>
                    Y: {sensorData.accelerometer.y.toFixed(3)} g
                  </RNText>
                  <RNText style={styles.dataText}>
                    Z: {sensorData.accelerometer.z.toFixed(3)} g
                  </RNText>
                </>
              ) : (
                <RNText style={styles.noData}>No accelerometer data</RNText>
              )}
            </View>

            {/* Gyroscope Data */}
            <View style={styles.dataCard}>
              <RNText style={styles.cardTitle}>Gyroscope</RNText>
              {sensorData.gyroscope ? (
                <>
                  <RNText style={styles.dataText}>
                    X: {sensorData.gyroscope.x.toFixed(3)} rad/s
                  </RNText>
                  <RNText style={styles.dataText}>
                    Y: {sensorData.gyroscope.y.toFixed(3)} rad/s
                  </RNText>
                  <RNText style={styles.dataText}>
                    Z: {sensorData.gyroscope.z.toFixed(3)} rad/s
                  </RNText>
                </>
              ) : (
                <RNText style={styles.noData}>No gyroscope data</RNText>
              )}
            </View>

            {/* Compass Data */}
            <View style={styles.dataCard}>
              <RNText style={styles.cardTitle}>Compass</RNText>
              {sensorData.compass ? (
                <>
                  <RNText style={styles.dataText}>
                    Magnetic: {sensorData.compass.magneticHeading.toFixed(1)}°
                  </RNText>
                  <RNText style={styles.dataText}>
                    True: {sensorData.compass.trueHeading.toFixed(1)}°
                  </RNText>
                  <RNText style={styles.dataText}>
                    Accuracy: ±{sensorData.compass.headingAccuracy.toFixed(1)}°
                  </RNText>
                </>
              ) : (
                <RNText style={styles.noData}>No compass data</RNText>
              )}
            </View>

            {/* Altimeter Data */}
            <View style={styles.dataCard}>
              <RNText style={styles.cardTitle}>Altimeter</RNText>
              {sensorData.altimeter ? (
                <>
                  <RNText style={styles.dataText}>
                    Altitude: {sensorData.altimeter.relativeAltitude.toFixed(1)}m
                  </RNText>
                  <RNText style={styles.dataText}>
                    Pressure: {sensorData.altimeter.pressure.toFixed(1)} hPa
                  </RNText>
                </>
              ) : (
                <RNText style={styles.noData}>No altimeter data</RNText>
              )}
            </View>

            {/* Battery Data */}
            <View style={styles.dataCard}>
              <RNText style={styles.cardTitle}>Battery</RNText>
              <RNText style={styles.dataText}>
                Level: {formatBatteryLevel(sensorData.battery.level)}
              </RNText>
              <RNText style={styles.dataText}>
                State: {sensorData.battery.state}
              </RNText>
              <RNText style={styles.dataText}>
                Charging: {sensorData.battery.isCharging ? 'Yes' : 'No'}
              </RNText>
            </View>

            {/* Device Info */}
            <View style={styles.dataCard}>
              <RNText style={styles.cardTitle}>Device</RNText>
              <RNText style={styles.dataText}>
                {sensorData.device.name}
              </RNText>
              <RNText style={styles.dataText}>
                {sensorData.device.model}
              </RNText>
              <RNText style={styles.dataText}>
                {sensorData.device.systemName} {sensorData.device.systemVersion}
              </RNText>
            </View>

            <RNText style={styles.timestamp}>
              Last updated: {new Date(sensorData.timestamp).toLocaleTimeString()}
            </RNText>
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
  beaconStatus: {
    marginBottom: 20,
  },
  dataSection: {
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
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#007AFF',
  },
  dataText: {
    fontSize: 14,
    marginVertical: 2,
    color: '#FFF',
  },
  noData: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
  },
  timestamp: {
    textAlign: 'center',
    marginTop: 16,
    fontSize: 12,
    color: '#999',
  },
});

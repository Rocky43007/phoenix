import { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { ScrollView, View, StyleSheet } from 'react-native';
import { Container, Text, Button } from '@phoenix/ui';
import { APP_NAME } from '@phoenix/utils';
import SensorDataModule, { AllSensorData } from './src/modules/SensorDataModule';

export default function App() {
  const [sensorData, setSensorData] = useState<AllSensorData | null>(null);
  const [isEmitting, setIsEmitting] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [permissionGranted, setPermissionGranted] = useState<boolean>(false);

  useEffect(() => {
    requestPermissions();
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

      // Request permissions if not already granted
      if (!permissionGranted) {
        const permResult = await SensorDataModule.requestLocationPermission();
        if (permResult.status === 'authorized') {
          setPermissionGranted(true);
        }
      }

      // Try to start location updates (will fail gracefully if no permission)
      try {
        await SensorDataModule.startLocationUpdates();
      } catch (locError) {
        console.log('Location updates unavailable:', locError);
      }

      // Try to start accelerometer updates (should work without permission)
      try {
        await SensorDataModule.startAccelerometerUpdates();
      } catch (accelError) {
        console.log('Accelerometer updates unavailable:', accelError);
      }

      // Try to start gyroscope updates (should work without permission)
      try {
        await SensorDataModule.startGyroscopeUpdates();
      } catch (gyroError) {
        console.log('Gyroscope updates unavailable:', gyroError);
      }

      // Try to start compass updates (may require location permission)
      try {
        await SensorDataModule.startCompassUpdates();
      } catch (compassError) {
        console.log('Compass updates unavailable:', compassError);
      }

      // Try to start altimeter updates (should work without permission)
      try {
        await SensorDataModule.startAltimeterUpdates();
      } catch (altError) {
        console.log('Altimeter updates unavailable:', altError);
      }

      setIsEmitting(true);

      // Get initial sensor data (will show null for unavailable sensors)
      await updateSensorData();
    } catch (error) {
      console.error('Error starting emission:', error);
      setError(`Error: ${error}`);
    }
  };

  const stopEmitting = async () => {
    try {
      await SensorDataModule.stopLocationUpdates();
      await SensorDataModule.stopAccelerometerUpdates();
      await SensorDataModule.stopGyroscopeUpdates();
      await SensorDataModule.stopCompassUpdates();
      await SensorDataModule.stopAltimeterUpdates();
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
    <Container>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <Text variant="title" style={styles.title}>{APP_NAME} Emitter</Text>
        <Text variant="body" style={styles.subtitle}>
          Emergency Beacon System
        </Text>

        <View style={styles.controlSection}>
          <Button
            title={isEmitting ? "Stop Broadcasting" : "Start Broadcasting"}
            onPress={isEmitting ? stopEmitting : startEmitting}
            variant={isEmitting ? "secondary" : "primary"}
          />

          <View style={[styles.statusIndicator, isEmitting && styles.statusActive]}>
            <Text variant="caption" style={styles.statusText}>
              {isEmitting ? '🟢 ACTIVE' : '⚫ INACTIVE'}
            </Text>
          </View>
        </View>

        {error ? (
          <View style={styles.errorBox}>
            <Text variant="caption" style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {sensorData && (
          <View style={styles.dataSection}>
            <Text variant="body" style={styles.sectionTitle}>Sensor Data</Text>

            {/* Location Data */}
            <View style={styles.dataCard}>
              <Text variant="body" style={styles.cardTitle}>Location</Text>
              {sensorData.location ? (
                <>
                  <Text variant="caption" style={styles.dataText}>
                    Lat: {sensorData.location.latitude.toFixed(6)}
                  </Text>
                  <Text variant="caption" style={styles.dataText}>
                    Lon: {sensorData.location.longitude.toFixed(6)}
                  </Text>
                  <Text variant="caption" style={styles.dataText}>
                    Alt: {sensorData.location.altitude.toFixed(1)}m
                  </Text>
                  <Text variant="caption" style={styles.dataText}>
                    Accuracy: ±{sensorData.location.accuracy.toFixed(1)}m
                  </Text>
                  <Text variant="caption" style={styles.dataText}>
                    Speed: {sensorData.location.speed.toFixed(1)} m/s
                  </Text>
                </>
              ) : (
                <Text variant="caption" style={styles.noData}>No location data</Text>
              )}
            </View>

            {/* Accelerometer Data */}
            <View style={styles.dataCard}>
              <Text variant="body" style={styles.cardTitle}>Accelerometer</Text>
              {sensorData.accelerometer ? (
                <>
                  <Text variant="caption" style={styles.dataText}>
                    X: {sensorData.accelerometer.x.toFixed(3)} g
                  </Text>
                  <Text variant="caption" style={styles.dataText}>
                    Y: {sensorData.accelerometer.y.toFixed(3)} g
                  </Text>
                  <Text variant="caption" style={styles.dataText}>
                    Z: {sensorData.accelerometer.z.toFixed(3)} g
                  </Text>
                </>
              ) : (
                <Text variant="caption" style={styles.noData}>No accelerometer data</Text>
              )}
            </View>

            {/* Gyroscope Data */}
            <View style={styles.dataCard}>
              <Text variant="body" style={styles.cardTitle}>Gyroscope</Text>
              {sensorData.gyroscope ? (
                <>
                  <Text variant="caption" style={styles.dataText}>
                    X: {sensorData.gyroscope.x.toFixed(3)} rad/s
                  </Text>
                  <Text variant="caption" style={styles.dataText}>
                    Y: {sensorData.gyroscope.y.toFixed(3)} rad/s
                  </Text>
                  <Text variant="caption" style={styles.dataText}>
                    Z: {sensorData.gyroscope.z.toFixed(3)} rad/s
                  </Text>
                </>
              ) : (
                <Text variant="caption" style={styles.noData}>No gyroscope data</Text>
              )}
            </View>

            {/* Compass Data */}
            <View style={styles.dataCard}>
              <Text variant="body" style={styles.cardTitle}>Compass</Text>
              {sensorData.compass ? (
                <>
                  <Text variant="caption" style={styles.dataText}>
                    Magnetic: {sensorData.compass.magneticHeading.toFixed(1)}°
                  </Text>
                  <Text variant="caption" style={styles.dataText}>
                    True: {sensorData.compass.trueHeading.toFixed(1)}°
                  </Text>
                  <Text variant="caption" style={styles.dataText}>
                    Accuracy: ±{sensorData.compass.headingAccuracy.toFixed(1)}°
                  </Text>
                </>
              ) : (
                <Text variant="caption" style={styles.noData}>No compass data</Text>
              )}
            </View>

            {/* Altimeter Data */}
            <View style={styles.dataCard}>
              <Text variant="body" style={styles.cardTitle}>Altimeter</Text>
              {sensorData.altimeter ? (
                <>
                  <Text variant="caption" style={styles.dataText}>
                    Altitude: {sensorData.altimeter.relativeAltitude.toFixed(1)}m
                  </Text>
                  <Text variant="caption" style={styles.dataText}>
                    Pressure: {sensorData.altimeter.pressure.toFixed(1)} hPa
                  </Text>
                </>
              ) : (
                <Text variant="caption" style={styles.noData}>No altimeter data</Text>
              )}
            </View>

            {/* Battery Data */}
            <View style={styles.dataCard}>
              <Text variant="body" style={styles.cardTitle}>Battery</Text>
              <Text variant="caption" style={styles.dataText}>
                Level: {formatBatteryLevel(sensorData.battery.level)}
              </Text>
              <Text variant="caption" style={styles.dataText}>
                State: {sensorData.battery.state}
              </Text>
              <Text variant="caption" style={styles.dataText}>
                Charging: {sensorData.battery.isCharging ? 'Yes' : 'No'}
              </Text>
            </View>

            {/* Device Info */}
            <View style={styles.dataCard}>
              <Text variant="body" style={styles.cardTitle}>Device</Text>
              <Text variant="caption" style={styles.dataText}>
                {sensorData.device.name}
              </Text>
              <Text variant="caption" style={styles.dataText}>
                {sensorData.device.model}
              </Text>
              <Text variant="caption" style={styles.dataText}>
                {sensorData.device.systemName} {sensorData.device.systemVersion}
              </Text>
            </View>

            <Text variant="caption" style={styles.timestamp}>
              Last updated: {new Date(sensorData.timestamp).toLocaleTimeString()}
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
  smallButton: {
    paddingVertical: 8,
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
    backgroundColor: '#D4EDDA',
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
  dataSection: {
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
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#007AFF',
  },
  dataText: {
    fontSize: 14,
    marginVertical: 2,
    color: '#333',
  },
  noData: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
  },
  timestamp: {
    textAlign: 'center',
    marginTop: 16,
    color: '#999',
  },
});

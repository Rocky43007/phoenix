import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions, Vibration } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import * as Location from 'expo-location';
import type { DiscoveredBeacon } from '../services/BeaconScanner';

interface PrecisionFindingViewProps {
  beacon: DiscoveredBeacon;
}

const { width, height } = Dimensions.get('window');
const CIRCLE_SIZE = Math.min(width, height) * 0.75;

// Arrow SVG component
const Arrow = ({ color, size = 80 }: { color: string; size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 100 100">
    <Path
      d="M50 10 L70 40 L58 40 L58 90 L42 90 L42 40 L30 40 Z"
      fill={color}
      stroke="#FFF"
      strokeWidth="3"
    />
  </Svg>
);

export function PrecisionFindingView({ beacon }: PrecisionFindingViewProps) {
  const [pulseAnim] = useState(new Animated.Value(1));
  const [rotateAnim] = useState(new Animated.Value(0));
  const [glowAnim] = useState(new Animated.Value(0));
  const [distance, setDistance] = useState<number>(0);
  const [distanceText, setDistanceText] = useState<string>('');
  const [proximityLevel, setProximityLevel] = useState<'far' | 'medium' | 'near' | 'here'>('far');
  const [bearing, setBearing] = useState<number>(0);
  const [compassHeading, setCompassHeading] = useState<number>(0);
  const [hasLocation, setHasLocation] = useState<boolean>(false);
  const [receiverLocation, setReceiverLocation] = useState<Location.LocationObject | null>(null);
  const [useFineTuning, setUseFineTuning] = useState<boolean>(false);
  const [usingGPSFallback, setUsingGPSFallback] = useState<boolean>(false);
  const lastProximityLevel = useRef<string>('far');
  const lastVibrationTime = useRef<number>(0);
  const lastBearing = useRef<number>(0);
  const distanceHistory = useRef<number[]>([]); // For smoothing distance
  const compassHistory = useRef<number[]>([]); // For smoothing compass
  const lastBeaconUpdate = useRef<number>(Date.now());
  const lastGPSDistance = useRef<number | null>(null);
  const previousReceiverLocation = useRef<{ lat: number; lon: number } | null>(null);

  // Calculate distance from GPS (Haversine formula)
  const calculateGPSDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371000; // Earth's radius in meters
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Calculate distance from RSSI or GPS fallback
  // Using simplified path loss formula: distance = 10 ^ ((measuredPower - RSSI) / (10 * n))
  // where n = 2 (path loss exponent for free space)
  useEffect(() => {
    const now = Date.now();
    const timeSinceLastBeacon = now - beacon.lastSeen;
    const BLE_TIMEOUT = 3000; // 3 seconds without BLE = use GPS fallback

    let calculatedDistance: number;

    // Use GPS distance if BLE signal is stale (> 3 seconds old)
    if (timeSinceLastBeacon > BLE_TIMEOUT && beacon.beaconData && receiverLocation) {
      // GPS-based distance calculation
      const gpsDistance = calculateGPSDistance(
        receiverLocation.coords.latitude,
        receiverLocation.coords.longitude,
        beacon.beaconData.latitude,
        beacon.beaconData.longitude
      );

      // Predict if user is getting closer by comparing to previous GPS distance
      if (lastGPSDistance.current !== null && previousReceiverLocation.current) {
        const previousDistance = calculateGPSDistance(
          previousReceiverLocation.current.lat,
          previousReceiverLocation.current.lon,
          beacon.beaconData.latitude,
          beacon.beaconData.longitude
        );

        // If moving closer, optimistically reduce distance slightly
        if (gpsDistance < previousDistance) {
          const movementSpeed = (previousDistance - gpsDistance) / ((now - lastBeaconUpdate.current) / 1000);
          // Predict forward 0.5 seconds based on movement speed
          calculatedDistance = Math.max(0, gpsDistance - (movementSpeed * 0.5));
        } else {
          calculatedDistance = gpsDistance;
        }
      } else {
        calculatedDistance = gpsDistance;
      }

      lastGPSDistance.current = gpsDistance;
      previousReceiverLocation.current = {
        lat: receiverLocation.coords.latitude,
        lon: receiverLocation.coords.longitude,
      };
    } else {
      // BLE RSSI-based distance calculation
      const measuredPower = -59; // RSSI at 1 meter
      const pathLossExponent = 2.0; // Free space (more accurate for close range)
      calculatedDistance = Math.pow(10, (measuredPower - beacon.rssi) / (10 * pathLossExponent));
      lastBeaconUpdate.current = beacon.lastSeen;
      setUsingGPSFallback(false);
    }

    // Track if we're using GPS fallback
    if (timeSinceLastBeacon > BLE_TIMEOUT) {
      setUsingGPSFallback(true);
    }

    // Smooth distance using moving average (10 samples)
    const MAX_HISTORY = 10;
    const updatedHistory = [...distanceHistory.current, calculatedDistance];
    if (updatedHistory.length > MAX_HISTORY) {
      updatedHistory.shift();
    }
    distanceHistory.current = updatedHistory;

    // Calculate smoothed distance
    const smoothedDistance = updatedHistory.reduce((sum, val) => sum + val, 0) / updatedHistory.length;
    setDistance(smoothedDistance);

    // Format distance text - "here" threshold at 50cm with hysteresis to prevent jumping
    // Hysteresis only applies when moving AWAY (upward in states), not when getting closer (downward)
    let newProximityLevel: 'far' | 'medium' | 'near' | 'here';

    const HYSTERESIS = 0.15; // 15cm
    const currentLevel = lastProximityLevel.current;

    // Determine the natural level based on distance
    let naturalLevel: 'far' | 'medium' | 'near' | 'here';
    if (smoothedDistance < 0.5) {
      naturalLevel = 'here';
    } else if (smoothedDistance < 1.5) {
      naturalLevel = 'near';
    } else if (smoothedDistance < 5) {
      naturalLevel = 'medium';
    } else {
      naturalLevel = 'far';
    }

    // Map states to priority (lower = closer)
    const statePriority = { 'here': 0, 'near': 1, 'medium': 2, 'far': 3 };
    const currentPriority = statePriority[currentLevel as keyof typeof statePriority] || 3;
    const naturalPriority = statePriority[naturalLevel];

    // Allow instant transition when getting closer (lower priority number)
    if (naturalPriority < currentPriority) {
      newProximityLevel = naturalLevel;
    }
    // Apply hysteresis only when moving away (higher priority number)
    else if (naturalPriority > currentPriority) {
      // Check if we've moved far enough beyond the threshold to change state
      if (currentLevel === 'here' && smoothedDistance >= 0.5 + HYSTERESIS) {
        newProximityLevel = naturalLevel;
      } else if (currentLevel === 'near' && smoothedDistance >= 1.5 + HYSTERESIS) {
        newProximityLevel = naturalLevel;
      } else if (currentLevel === 'medium' && smoothedDistance >= 5 + HYSTERESIS) {
        newProximityLevel = naturalLevel;
      } else {
        // Stay in current level (hysteresis prevents jumping)
        newProximityLevel = currentLevel as 'far' | 'medium' | 'near' | 'here';
      }
    }
    // Same level - no change
    else {
      newProximityLevel = naturalLevel;
    }

    // Format distance text based on level (imperial units)
    // 1 meter = 3.28084 feet
    const distanceInFeet = smoothedDistance * 3.28084;

    if (newProximityLevel === 'here') {
      setDistanceText('Here');
    } else if (distanceInFeet < 5) {
      // Under 5 feet: show in inches
      const inches = Math.round(distanceInFeet * 12);
      setDistanceText(`${inches}"`);
    } else if (distanceInFeet < 100) {
      // 5-100 feet: show in feet with decimal
      setDistanceText(`${distanceInFeet.toFixed(1)} ft`);
    } else {
      // Over 100 feet: show whole feet
      setDistanceText(`${Math.round(distanceInFeet)} ft`);
    }

    setProximityLevel(newProximityLevel);

    // Continuous haptic feedback - buzz frequency increases as you get closer
    // Starts buzzing within 3m, gets progressively faster
    // STOPS when we reach "here" (< 0.5m)
    let vibrationInterval: number;

    // Use actual distance for fine-grained control within close range (< 3m)
    if (smoothedDistance < 0.5) {
      // Here: STOP vibration - we found it!
      vibrationInterval = 0;
    } else if (smoothedDistance < 1.5) {
      // Near (< 1.5m): Fast pulses
      vibrationInterval = 700;
    } else if (smoothedDistance < 3) {
      // Close (< 3m): Progressive increase from 2s to 1s
      // At 3m: every 2s, at 1.5m: every 1s
      const ratio = (smoothedDistance - 1.5) / (3 - 1.5); // 0 to 1
      vibrationInterval = 1000 + (ratio * 1000); // 1s to 2s
    } else {
      // Far (> 3m): No vibration
      vibrationInterval = 0;
    }

    if (vibrationInterval > 0 && now - lastVibrationTime.current >= vibrationInterval) {
      // Vibration pattern gets more intense as you get closer
      if (smoothedDistance < 1.5) {
        // Double pulse for "very close"
        Vibration.vibrate([0, 80, 50, 80]);
      } else {
        // Single pulse for "getting closer"
        Vibration.vibrate(100);
      }
      lastVibrationTime.current = now;
    }
    lastProximityLevel.current = newProximityLevel;
  }, [beacon.rssi, beacon.lastSeen, beacon.beaconData, receiverLocation]);

  // Continuous GPS distance recalculation when using GPS fallback
  useEffect(() => {
    if (!usingGPSFallback || !beacon.beaconData || !receiverLocation) {
      return;
    }

    // Update GPS distance every 250ms when in fallback mode
    const gpsUpdateInterval = setInterval(() => {
      const gpsDistance = calculateGPSDistance(
        receiverLocation.coords.latitude,
        receiverLocation.coords.longitude,
        beacon.beaconData!.latitude,
        beacon.beaconData!.longitude
      );

      // Predict movement
      if (lastGPSDistance.current !== null && previousReceiverLocation.current) {
        const previousDistance = calculateGPSDistance(
          previousReceiverLocation.current.lat,
          previousReceiverLocation.current.lon,
          beacon.beaconData!.latitude,
          beacon.beaconData!.longitude
        );

        let predictedDistance = gpsDistance;
        if (gpsDistance < previousDistance) {
          const movementSpeed = (previousDistance - gpsDistance) / 0.25; // 250ms intervals
          predictedDistance = Math.max(0, gpsDistance - (movementSpeed * 0.125));
        }

        setDistance(predictedDistance);
        lastGPSDistance.current = gpsDistance;
        previousReceiverLocation.current = {
          lat: receiverLocation.coords.latitude,
          lon: receiverLocation.coords.longitude,
        };
      }
    }, 250); // Update every 250ms

    return () => clearInterval(gpsUpdateInterval);
  }, [usingGPSFallback, beacon.beaconData, receiverLocation]);

  // Pulse animation based on proximity
  useEffect(() => {
    let animationDuration = 2000;

    switch (proximityLevel) {
      case 'here':
        animationDuration = 300;
        break;
      case 'near':
        animationDuration = 600;
        break;
      case 'medium':
        animationDuration = 1200;
        break;
      case 'far':
        animationDuration = 2000;
        break;
    }

    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.15,
          duration: animationDuration / 2,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: animationDuration / 2,
          useNativeDriver: true,
        }),
      ])
    );

    pulseAnimation.start();

    return () => {
      pulseAnimation.stop();
    };
  }, [proximityLevel, pulseAnim]);

  // Glow animation (always on)
  useEffect(() => {
    const glowAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 0,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    );

    glowAnimation.start();

    return () => {
      glowAnimation.stop();
    };
  }, [glowAnim]);

  // Start receiver location tracking
  useEffect(() => {
    let subscription: Location.LocationSubscription;
    let headingSubscription: Location.LocationSubscription;

    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          console.warn('Location permission not granted for receiver');
          return;
        }

        // Watch position with battery-aware accuracy
        // High accuracy drains battery fast, so use balanced mode for lower battery
        const batteryLevel = beacon.beaconData?.battery ?? 100;
        const accuracy = batteryLevel > 20
          ? Location.Accuracy.High
          : Location.Accuracy.Balanced;

        subscription = await Location.watchPositionAsync(
          {
            accuracy,
            distanceInterval: 1,
          },
          (location) => {
            setReceiverLocation(location);
          }
        );

        console.log(`📍 Receiver GPS accuracy: ${batteryLevel > 20 ? 'High' : 'Balanced (battery saving)'}`);


        // Watch heading (compass) with smoothing
        headingSubscription = await Location.watchHeadingAsync((heading) => {
          // Smooth compass heading to reduce jitter
          const MAX_COMPASS_HISTORY = 5;
          const updatedCompassHistory = [...compassHistory.current, heading.trueHeading];
          if (updatedCompassHistory.length > MAX_COMPASS_HISTORY) {
            updatedCompassHistory.shift();
          }
          compassHistory.current = updatedCompassHistory;

          // Calculate average compass heading (handling wraparound at 0/360)
          const avgHeading = updatedCompassHistory.reduce((sum, val) => sum + val, 0) / updatedCompassHistory.length;
          setCompassHeading(avgHeading);
        });
      } catch (error) {
        console.error('Failed to start receiver location tracking:', error);
      }
    })();

    return () => {
      if (subscription) {
        subscription.remove();
      }
      if (headingSubscription) {
        headingSubscription.remove();
      }
    };
  }, []);

  // Calculate bearing from receiver to beacon
  const calculateBearing = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const lat1Rad = lat1 * Math.PI / 180;
    const lat2Rad = lat2 * Math.PI / 180;

    const y = Math.sin(dLon) * Math.cos(lat2Rad);
    const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) -
              Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);

    let bearing = Math.atan2(y, x) * 180 / Math.PI;
    return (bearing + 360) % 360; // Normalize to 0-360
  };

  // Update bearing when locations or compass heading changes
  useEffect(() => {
    // Use GPS coordinates even if gpsValid is false (we cache last known position)
    if (beacon.beaconData && receiverLocation) {
      // Calculate absolute bearing from receiver to beacon (north = 0°)
      const absoluteBearing = calculateBearing(
        receiverLocation.coords.latitude,
        receiverLocation.coords.longitude,
        beacon.beaconData.latitude,
        beacon.beaconData.longitude
      );

      // Enable fine-tuning mode when very close (< 1.5m)
      // In this mode, we'll use more responsive compass-based direction
      if (distance < 1.5) {
        setUseFineTuning(true);
      } else {
        setUseFineTuning(false);
      }

      // Adjust for device compass heading (which direction the device is pointing)
      // If device points north (0°) and beacon is east (90°), arrow should point right (90°)
      // If device points east (90°) and beacon is east (90°), arrow should point up (0°)
      const relativeBearing = (absoluteBearing - compassHeading + 360) % 360;

      // Small deadzone (5°) to prevent tiny jitters while keeping responsiveness
      const DEADZONE = 5;
      const bearingDiff = Math.abs(relativeBearing - lastBearing.current);
      const normalizedDiff = Math.min(bearingDiff, 360 - bearingDiff);

      if (normalizedDiff > DEADZONE || lastBearing.current === 0) {
        setBearing(relativeBearing);
        lastBearing.current = relativeBearing;
      }

      setHasLocation(true);

      const gpsStatus = beacon.beaconData.flags.gpsValid ? '' : ' (cached GPS)';
      console.log(`
DIRECTION DEBUG${gpsStatus}:
  Receiver: (${receiverLocation.coords.latitude.toFixed(6)}, ${receiverLocation.coords.longitude.toFixed(6)})
  Beacon:   (${beacon.beaconData.latitude.toFixed(6)}, ${beacon.beaconData.longitude.toFixed(6)})
  Absolute Bearing: ${absoluteBearing.toFixed(1)}° (from receiver to beacon, north = 0°)
  Compass Heading:  ${compassHeading.toFixed(1)}° (device pointing)
  Relative Bearing: ${relativeBearing.toFixed(1)}° (arrow rotation)
  Distance: ${distance.toFixed(2)}m
`);
    } else {
      setHasLocation(false);
    }
  }, [beacon.beaconData, receiverLocation, compassHeading, distance, useFineTuning]);

  // Animate arrow rotation to point toward bearing
  useEffect(() => {
    if (hasLocation) {
      // Use timing animation for smoother, more controlled movement
      // This prevents jitter while still being responsive
      Animated.timing(rotateAnim, {
        toValue: bearing,
        duration: 300, // Smooth transition
        useNativeDriver: true,
      }).start();
    } else {
      // Wiggle animation when no GPS lock
      const wiggleAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(rotateAnim, {
            toValue: 15,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(rotateAnim, {
            toValue: -15,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      );

      wiggleAnimation.start();

      return () => {
        wiggleAnimation.stop();
      };
    }
  }, [bearing, hasLocation, useFineTuning, rotateAnim]);

  // Get color based on proximity
  const getProximityColor = (): string => {
    switch (proximityLevel) {
      case 'here':
        return '#34C759'; // Green
      case 'near':
        return '#30D158'; // Light green
      case 'medium':
        return '#FF9F0A'; // Orange
      case 'far':
        return '#007AFF'; // Blue
    }
  };

  const getProximityMessage = (): string => {
    switch (proximityLevel) {
      case 'here':
        return 'Device is right here';
      case 'near':
        return 'Very close';
      case 'medium':
        return 'Nearby';
      case 'far':
        return 'Keep moving';
    }
  };

  const formatTimeSince = (timestamp: number): string => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 2) return 'just now';
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.deviceName}>
          {beacon.beaconData ? 'Phoenix Beacon' : beacon.id}
        </Text>

        {/* Signal and update info */}
        <View style={styles.signalRow}>
          <Text style={[
            styles.signalStatus,
            usingGPSFallback ? styles.signalLost : styles.signalActive
          ]}>
            {usingGPSFallback ? 'GPS Fallback Mode' : `Signal: ${beacon.rssi} dBm`}
          </Text>
          <Text style={styles.lastUpdated}>
            {usingGPSFallback ? 'Using GPS tracking' : `Updated ${formatTimeSince(beacon.lastSeen)}`}
          </Text>
        </View>

        {/* Priority Alerts - only show critical ones on precision finding page */}
        {beacon.beaconData && (beacon.beaconData.flags.fallDetected || beacon.beaconData.flags.sosActivated) && (
          <View style={styles.priorityAlerts}>
            {beacon.beaconData.flags.sosActivated && (
              <View style={[styles.alertBadge, styles.alertCritical]}>
                <Text style={styles.alertText}>SOS ACTIVATED</Text>
              </View>
            )}
            {beacon.beaconData.flags.fallDetected && (
              <View style={[styles.alertBadge, styles.alertUrgent]}>
                <Text style={styles.alertText}>FALL DETECTED</Text>
                <Text style={styles.alertTimestamp}>{formatTimeSince(beacon.lastSeen)}</Text>
              </View>
            )}
          </View>
        )}
      </View>

      {/* Main circular interface */}
      <View style={styles.circleContainer}>
        {/* Compass Rose */}
        <View style={styles.compassRose}>
          <Text style={[styles.compassLabel, styles.compassN]}>N</Text>
          <Text style={[styles.compassLabel, styles.compassE]}>E</Text>
          <Text style={[styles.compassLabel, styles.compassS]}>S</Text>
          <Text style={[styles.compassLabel, styles.compassW]}>W</Text>
        </View>

        {/* Outer rings */}
        <View style={[styles.ring, styles.ringOuter, { borderColor: getProximityColor() + '20' }]} />
        <View style={[styles.ring, styles.ringMiddle, { borderColor: getProximityColor() + '40' }]} />

        {/* Animated center circle */}
        <Animated.View
          style={[
            styles.centerCircle,
            {
              backgroundColor: getProximityColor(),
              transform: [{ scale: pulseAnim }],
              shadowColor: getProximityColor(),
              shadowOpacity: glowAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0.3, 0.8],
              }),
              shadowRadius: glowAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [8, 20],
              }),
            },
          ]}
        >
          {/* Directional arrow with rotation - hide when very close (< 0.5m) */}
          {proximityLevel !== 'here' && (
            <Animated.View
              style={[
                styles.arrowContainer,
                {
                  transform: [
                    {
                      rotate: hasLocation
                        ? rotateAnim.interpolate({
                            inputRange: [0, 360],
                            outputRange: ['0deg', '360deg'],
                          })
                        : rotateAnim.interpolate({
                            inputRange: [-15, 0, 15],
                            outputRange: ['-15deg', '0deg', '15deg'],
                          }),
                    },
                  ],
                },
              ]}
            >
              <Arrow color="#FFF" size={100} />
            </Animated.View>
          )}
        </Animated.View>

        {/* Distance display */}
        <View style={styles.distanceContainer}>
          <Text style={[styles.distanceText, { color: getProximityColor() }]}>
            {distanceText}
          </Text>
          <Text style={styles.proximityMessage}>
            {getProximityMessage()}
          </Text>
          {/* Fine-tuning indicator - below proximity message */}
          {useFineTuning && (
            <View style={styles.fineTuningIndicator}>
              <Text style={styles.fineTuningText}>Fine-Tuning Active</Text>
            </View>
          )}
        </View>
      </View>

      {/* Beacon data - minimal essential info */}
      {beacon.beaconData && (
        <View style={styles.dataContainer}>
          <View style={styles.dataRow}>
            <View style={styles.dataLeft}>
              <Text style={styles.dataLabel}>Battery</Text>
              <Text style={styles.dataValueLarge}>{beacon.beaconData.battery}%</Text>
            </View>
            {beacon.beaconData.flags.gpsValid && (
              <View style={styles.dataRight}>
                <Text style={styles.dataLabel}>Altitude</Text>
                <Text style={styles.dataValueLarge}>{beacon.beaconData.altitudeMSL}m</Text>
              </View>
            )}
          </View>

          {beacon.beaconData.flags.gpsValid && (
            <View style={styles.locationRow}>
              <Text style={styles.locationLabel}>Device Location</Text>
              <Text style={styles.locationCoords}>
                {Math.abs(beacon.beaconData.latitude).toFixed(4)}°{beacon.beaconData.latitude >= 0 ? 'N' : 'S'},{' '}
                {Math.abs(beacon.beaconData.longitude).toFixed(4)}°{beacon.beaconData.longitude >= 0 ? 'E' : 'W'}
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    paddingTop: 20,
    paddingBottom: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
    marginTop: 2,
  },
  deviceName: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 12,
  },
  signalRow: {
    alignItems: 'center',
    marginBottom: 8,
  },
  signalStatus: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  signalActive: {
    color: '#34C759',
  },
  signalLost: {
    color: '#FF3B30',
  },
  lastUpdated: {
    fontSize: 12,
    color: '#999',
  },
  priorityAlerts: {
    width: '100%',
    paddingHorizontal: 20,
    gap: 8,
    marginTop: 12,
    marginBottom: 12,
  },
  alertBadge: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 2,
  },
  alertCritical: {
    backgroundColor: 'rgba(255, 59, 48, 0.2)',
    borderColor: '#FF3B30',
  },
  alertUrgent: {
    backgroundColor: 'rgba(255, 159, 10, 0.2)',
    borderColor: '#FF9F0A',
  },
  alertWarning: {
    backgroundColor: 'rgba(255, 204, 0, 0.2)',
    borderColor: '#FFCC00',
  },
  alertText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
    letterSpacing: 1,
  },
  alertTimestamp: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: 4,
  },
  signalStrength: {
    fontSize: 14,
    color: '#999',
  },
  circleContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  compassRose: {
    position: 'absolute',
    width: CIRCLE_SIZE * 1.1,
    height: CIRCLE_SIZE * 1.1,
  },
  compassLabel: {
    position: 'absolute',
    fontSize: 18,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.5)',
  },
  compassN: {
    top: 0,
    left: '50%',
    transform: [{ translateX: -9 }],
  },
  compassE: {
    right: 0,
    top: '50%',
    transform: [{ translateY: -12 }],
  },
  compassS: {
    bottom: 0,
    left: '50%',
    transform: [{ translateX: -9 }],
  },
  compassW: {
    left: 0,
    top: '50%',
    transform: [{ translateY: -12 }],
  },
  ring: {
    position: 'absolute',
    borderRadius: 9999,
    borderWidth: 2,
  },
  ringOuter: {
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
  },
  ringMiddle: {
    width: CIRCLE_SIZE * 0.7,
    height: CIRCLE_SIZE * 0.7,
  },
  centerCircle: {
    width: CIRCLE_SIZE * 0.4,
    height: CIRCLE_SIZE * 0.4,
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  arrowContainer: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  foundContainer: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  foundText: {
    fontSize: 32,
    color: '#FFF',
    fontWeight: '700',
    letterSpacing: 4,
  },
  distanceContainer: {
    position: 'absolute',
    bottom: -100,
    alignItems: 'center',
  },
  distanceText: {
    fontSize: 48,
    fontWeight: '700',
    marginBottom: 8,
  },
  proximityMessage: {
    fontSize: 18,
    color: '#999',
  },
  fineTuningIndicator: {
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'rgba(52, 199, 89, 0.15)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(52, 199, 89, 0.5)',
  },
  fineTuningText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#34C759',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  gpsWarning: {
    position: 'absolute',
    bottom: -50,
    backgroundColor: 'rgba(255, 159, 10, 0.2)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#FF9F0A',
  },
  gpsWarningText: {
    color: '#FF9F0A',
    fontSize: 12,
    fontWeight: '600',
  },
  dataContainer: {
    paddingHorizontal: 24,
    paddingTop: 30,
    paddingBottom: 20,
  },
  dataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  dataLeft: {
    flex: 1,
    alignItems: 'flex-start',
  },
  dataRight: {
    flex: 1,
    alignItems: 'flex-end',
  },
  dataLabel: {
    fontSize: 13,
    color: '#999',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dataValue: {
    fontSize: 16,
    color: '#FFF',
    fontWeight: '500',
  },
  dataValueLarge: {
    fontSize: 28,
    color: '#FFF',
    fontWeight: '700',
  },
  locationRow: {
    marginBottom: 20,
  },
  locationLabel: {
    fontSize: 13,
    color: '#999',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  movementRow: {
    marginBottom: 20,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(52, 199, 89, 0.1)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(52, 199, 89, 0.3)',
  },
  movementLabel: {
    fontSize: 13,
    color: '#34C759',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: '600',
  },
  movementText: {
    fontSize: 14,
    color: '#FFF',
  },
  locationCoords: {
    fontSize: 16,
    color: '#FFF',
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
  },
  statusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 16,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusActive: {
    backgroundColor: '#34C759',
  },
  statusWarn: {
    backgroundColor: '#FF9F0A',
  },
  statusCritical: {
    backgroundColor: '#FF3B30',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFF',
  },
});

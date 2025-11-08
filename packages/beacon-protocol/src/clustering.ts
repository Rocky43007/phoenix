/**
 * DBSCAN Clustering Algorithm for Geographic Grouping
 *
 * Groups emitters by geographic proximity for easier navigation
 */

import type { Emitter, EmitterCluster, ClusteringInput, ClusteringOutput, Location } from './types';
import { CLUSTERING_CONFIG } from './constants';

/**
 * Calculate distance between two geographic points using Haversine formula
 *
 * @param point1 - First location
 * @param point2 - Second location
 * @returns Distance in meters
 */
export function calculateDistance(point1: Location, point2: Location): number {
  const R = 6371000; // Earth's radius in meters
  const lat1 = (point1.latitude * Math.PI) / 180;
  const lat2 = (point2.latitude * Math.PI) / 180;
  const deltaLat = ((point2.latitude - point1.latitude) * Math.PI) / 180;
  const deltaLon = ((point2.longitude - point1.longitude) * Math.PI) / 180;

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Calculate the geographic center of a group of emitters
 *
 * @param emitters - Array of emitters
 * @returns Center point location
 */
export function calculateCenter(emitters: Emitter[]): Location {
  if (emitters.length === 0) {
    throw new Error('Cannot calculate center of empty array');
  }

  const sum = emitters.reduce(
    (acc, emitter) => ({
      latitude: acc.latitude + emitter.latitude,
      longitude: acc.longitude + emitter.longitude,
      altitude: acc.altitude + (emitter.altitudeMSL || 0),
    }),
    { latitude: 0, longitude: 0, altitude: 0 }
  );

  return {
    latitude: sum.latitude / emitters.length,
    longitude: sum.longitude / emitters.length,
    altitude: sum.altitude / emitters.length,
  };
}

/**
 * Calculate urgency score for a cluster
 *
 * Higher score = more urgent (low battery, SOS, stationary)
 *
 * @param emitters - Array of emitters in cluster
 * @returns Urgency score (0-100)
 */
export function calculateUrgencyScore(emitters: Emitter[]): number {
  let totalScore = 0;

  for (const emitter of emitters) {
    let score = 0;

    // Low battery increases urgency
    if (emitter.flags.lowBattery) score += 30;
    else if (emitter.battery < 50) score += 15;

    // SOS activated is highest priority
    if (emitter.flags.sosActivated) score += 50;

    // Stationary (possibly trapped)
    if (emitter.flags.stationary) score += 20;

    // Weak signal (possibly buried/trapped)
    if (emitter.rssi < -80) score += 10;

    totalScore += Math.min(100, score);
  }

  return Math.min(100, Math.round(totalScore / emitters.length));
}

/**
 * DBSCAN clustering algorithm
 *
 * Groups emitters that are within epsilonMeters of each other
 *
 * @param input - Clustering configuration and emitter data
 * @returns Clusters and noise points
 */
export function clusterEmitters(input: ClusteringInput): ClusteringOutput {
  const { emitters, epsilonMeters, minPoints } = input;

  const clusters: EmitterCluster[] = [];
  const noise: Emitter[] = [];
  const visited = new Set<string>();
  const clustered = new Set<string>();

  // Find neighbors within epsilon distance
  function getNeighbors(emitter: Emitter): Emitter[] {
    return emitters.filter(
      (other) =>
        other.deviceId !== emitter.deviceId &&
        calculateDistance(emitter, other) <= epsilonMeters
    );
  }

  // Expand cluster from seed point
  function expandCluster(seed: Emitter, neighbors: Emitter[]): Emitter[] {
    const clusterMembers: Emitter[] = [seed];
    const queue = [...neighbors];

    while (queue.length > 0) {
      const current = queue.shift()!;

      if (!visited.has(current.deviceId)) {
        visited.add(current.deviceId);
        const currentNeighbors = getNeighbors(current);

        if (currentNeighbors.length >= minPoints) {
          for (const neighbor of currentNeighbors) {
            if (!visited.has(neighbor.deviceId)) {
              queue.push(neighbor);
            }
          }
        }
      }

      if (!clustered.has(current.deviceId)) {
        clusterMembers.push(current);
        clustered.add(current.deviceId);
      }
    }

    return clusterMembers;
  }

  // Main DBSCAN algorithm
  for (const emitter of emitters) {
    if (visited.has(emitter.deviceId)) continue;

    visited.add(emitter.deviceId);
    const neighbors = getNeighbors(emitter);

    if (neighbors.length < minPoints) {
      // Not enough neighbors - mark as noise (for now)
      if (!clustered.has(emitter.deviceId)) {
        noise.push(emitter);
      }
    } else {
      // Expand cluster from this seed point
      clustered.add(emitter.deviceId);
      const clusterMembers = expandCluster(emitter, neighbors);

      const center = calculateCenter(clusterMembers);
      const avgBattery = Math.round(
        clusterMembers.reduce((sum, e) => sum + e.battery, 0) / clusterMembers.length
      );
      const urgencyScore = calculateUrgencyScore(clusterMembers);

      clusters.push({
        id: `cluster-${clusters.length + 1}`,
        center,
        emitters: clusterMembers,
        count: clusterMembers.length,
        avgBattery,
        urgencyScore,
      });
    }
  }

  return { clusters, noise };
}

/**
 * Sort clusters by priority (urgency score)
 *
 * @param clusters - Array of clusters
 * @returns Sorted array (highest urgency first)
 */
export function sortClustersByUrgency(clusters: EmitterCluster[]): EmitterCluster[] {
  return [...clusters].sort((a, b) => b.urgencyScore - a.urgencyScore);
}

/**
 * Filter stale emitters (not seen recently)
 *
 * @param emitters - Array of emitters
 * @param timeoutMs - Timeout in milliseconds (default: 60s)
 * @returns Filtered array of active emitters
 */
export function filterStaleEmitters(emitters: Emitter[], timeoutMs = CLUSTERING_CONFIG.STALE_TIMEOUT_MS): Emitter[] {
  const now = Date.now();
  return emitters.filter((emitter) => now - emitter.lastSeen < timeoutMs);
}

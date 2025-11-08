import Foundation
import React
import CoreLocation
import CoreMotion
import UIKit

@objc(SensorDataModule)
class SensorDataModule: NSObject {

  private let locationManager = CLLocationManager()
  private let motionManager = CMMotionManager()
  private let altimeter = CMAltimeter()
  private var lastKnownLocation: CLLocation?
  private var lastKnownHeading: CLHeading?
  private var lastAltitudeData: CMAltitudeData?

  override init() {
    super.init()
    setupLocationManager()
    setupMotionManager()
  }

  @objc
  static func requiresMainQueueSetup() -> Bool {
    return true // Need main queue for location manager
  }

  // MARK: - Setup

  private func setupLocationManager() {
    locationManager.delegate = self
    locationManager.desiredAccuracy = kCLLocationAccuracyBest
    locationManager.distanceFilter = 10 // Update every 10 meters
    // Note: allowsBackgroundLocationUpdates is set in startLocationUpdates after permissions are granted
  }

  private func setupMotionManager() {
    motionManager.accelerometerUpdateInterval = 0.1 // 10 Hz
  }

  // MARK: - Location Data

  @objc
  func requestLocationPermission(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    DispatchQueue.main.async {
      let status = CLLocationManager.authorizationStatus()

      switch status {
      case .notDetermined:
        self.locationManager.requestAlwaysAuthorization()
        resolve(["status": "requested"])
      case .authorizedAlways, .authorizedWhenInUse:
        resolve(["status": "authorized"])
      case .denied, .restricted:
        resolve(["status": "denied"])
      @unknown default:
        resolve(["status": "unknown"])
      }
    }
  }

  @objc
  func startLocationUpdates(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    DispatchQueue.main.async {
      let status = CLLocationManager.authorizationStatus()

      guard status == .authorizedAlways || status == .authorizedWhenInUse else {
        reject("PERMISSION_ERROR", "Location permission not granted", nil)
        return
      }

      // Enable background location updates if user granted "Always" permission
      // This requires UIBackgroundModes to be configured in Info.plist (handled by our config plugin)
      if status == .authorizedAlways {
        self.locationManager.allowsBackgroundLocationUpdates = true
        self.locationManager.pausesLocationUpdatesAutomatically = false
      }

      self.locationManager.startUpdatingLocation()
      resolve(["status": "started"])
    }
  }

  @objc
  func stopLocationUpdates(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    DispatchQueue.main.async {
      self.locationManager.stopUpdatingLocation()
      resolve(["status": "stopped"])
    }
  }

  @objc
  func getCurrentLocation(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    guard let location = lastKnownLocation else {
      reject("NO_LOCATION", "No location data available", nil)
      return
    }

    let locationData: [String: Any] = [
      "latitude": location.coordinate.latitude,
      "longitude": location.coordinate.longitude,
      "altitude": location.altitude,
      "accuracy": location.horizontalAccuracy,
      "altitudeAccuracy": location.verticalAccuracy,
      "speed": location.speed,
      "speedAccuracy": location.speedAccuracy,
      "course": location.course,
      "courseAccuracy": location.courseAccuracy,
      "timestamp": location.timestamp.timeIntervalSince1970 * 1000 // Convert to milliseconds
    ]

    resolve(locationData)
  }

  // MARK: - Accelerometer Data

  @objc
  func getAccelerometerData(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    guard motionManager.isAccelerometerAvailable else {
      reject("UNAVAILABLE", "Accelerometer not available on this device", nil)
      return
    }

    if !motionManager.isAccelerometerActive {
      motionManager.startAccelerometerUpdates()
    }

    guard let data = motionManager.accelerometerData else {
      reject("NO_DATA", "No accelerometer data available", nil)
      return
    }

    let accelerometerData: [String: Any] = [
      "x": data.acceleration.x,
      "y": data.acceleration.y,
      "z": data.acceleration.z,
      "timestamp": data.timestamp * 1000 // Convert to milliseconds
    ]

    resolve(accelerometerData)
  }

  @objc
  func startAccelerometerUpdates(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    guard motionManager.isAccelerometerAvailable else {
      reject("UNAVAILABLE", "Accelerometer not available on this device", nil)
      return
    }

    motionManager.startAccelerometerUpdates()
    resolve(["status": "started"])
  }

  @objc
  func stopAccelerometerUpdates(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    motionManager.stopAccelerometerUpdates()
    resolve(["status": "stopped"])
  }

  // MARK: - Gyroscope Data

  @objc
  func getGyroscopeData(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    guard motionManager.isGyroAvailable else {
      reject("UNAVAILABLE", "Gyroscope not available on this device", nil)
      return
    }

    if !motionManager.isGyroActive {
      motionManager.startGyroUpdates()
    }

    guard let data = motionManager.gyroData else {
      reject("NO_DATA", "No gyroscope data available", nil)
      return
    }

    let gyroscopeData: [String: Any] = [
      "x": data.rotationRate.x,
      "y": data.rotationRate.y,
      "z": data.rotationRate.z,
      "timestamp": data.timestamp * 1000
    ]

    resolve(gyroscopeData)
  }

  @objc
  func startGyroscopeUpdates(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    guard motionManager.isGyroAvailable else {
      reject("UNAVAILABLE", "Gyroscope not available on this device", nil)
      return
    }

    motionManager.gyroUpdateInterval = 0.1 // 10 Hz
    motionManager.startGyroUpdates()
    resolve(["status": "started"])
  }

  @objc
  func stopGyroscopeUpdates(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    motionManager.stopGyroUpdates()
    resolve(["status": "stopped"])
  }

  // MARK: - Magnetometer/Compass Data

  @objc
  func startCompassUpdates(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    DispatchQueue.main.async {
      if CLLocationManager.headingAvailable() {
        self.locationManager.startUpdatingHeading()
        resolve(["status": "started"])
      } else {
        reject("UNAVAILABLE", "Compass not available on this device", nil)
      }
    }
  }

  @objc
  func stopCompassUpdates(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    DispatchQueue.main.async {
      self.locationManager.stopUpdatingHeading()
      resolve(["status": "stopped"])
    }
  }

  @objc
  func getCompassData(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    guard let heading = lastKnownHeading else {
      reject("NO_DATA", "No compass data available", nil)
      return
    }

    let compassData: [String: Any] = [
      "magneticHeading": heading.magneticHeading,
      "trueHeading": heading.trueHeading,
      "headingAccuracy": heading.headingAccuracy,
      "x": heading.x,
      "y": heading.y,
      "z": heading.z,
      "timestamp": heading.timestamp.timeIntervalSince1970 * 1000
    ]

    resolve(compassData)
  }

  // MARK: - Altimeter/Barometer Data

  @objc
  func startAltimeterUpdates(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    guard CMAltimeter.isRelativeAltitudeAvailable() else {
      reject("UNAVAILABLE", "Altimeter not available on this device", nil)
      return
    }

    altimeter.startRelativeAltitudeUpdates(to: OperationQueue.main) { [weak self] (data, error) in
      if let error = error {
        print("Altimeter error: \(error.localizedDescription)")
        return
      }
      self?.lastAltitudeData = data
    }

    resolve(["status": "started"])
  }

  @objc
  func stopAltimeterUpdates(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    altimeter.stopRelativeAltitudeUpdates()
    resolve(["status": "stopped"])
  }

  @objc
  func getAltimeterData(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    guard let data = lastAltitudeData else {
      reject("NO_DATA", "No altimeter data available", nil)
      return
    }

    let altimeterData: [String: Any] = [
      "relativeAltitude": data.relativeAltitude.doubleValue, // meters
      "pressure": data.pressure.doubleValue * 10.0, // convert kPa to hPa (millibars)
      "timestamp": Date().timeIntervalSince1970 * 1000
    ]

    resolve(altimeterData)
  }

  // MARK: - Battery Data

  @objc
  func getBatteryInfo(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    UIDevice.current.isBatteryMonitoringEnabled = true

    let batteryLevel = UIDevice.current.batteryLevel
    let batteryState = UIDevice.current.batteryState

    var stateString = "unknown"
    switch batteryState {
    case .unplugged:
      stateString = "unplugged"
    case .charging:
      stateString = "charging"
    case .full:
      stateString = "full"
    default:
      stateString = "unknown"
    }

    let batteryInfo: [String: Any] = [
      "level": batteryLevel >= 0 ? batteryLevel : -1, // -1 if unavailable
      "state": stateString,
      "isCharging": batteryState == .charging || batteryState == .full
    ]

    resolve(batteryInfo)
  }

  // MARK: - Device Info

  @objc
  func getDeviceInfo(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    let deviceInfo: [String: Any] = [
      "model": UIDevice.current.model,
      "systemName": UIDevice.current.systemName,
      "systemVersion": UIDevice.current.systemVersion,
      "name": UIDevice.current.name,
      "identifier": UIDevice.current.identifierForVendor?.uuidString ?? "unknown"
    ]
    resolve(deviceInfo)
  }

  // MARK: - All Sensor Data

  @objc
  func getAllSensorData(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    var sensorData: [String: Any] = [:]

    // Location data
    if let location = lastKnownLocation {
      sensorData["location"] = [
        "latitude": location.coordinate.latitude,
        "longitude": location.coordinate.longitude,
        "altitude": location.altitude,
        "accuracy": location.horizontalAccuracy,
        "speed": location.speed,
        "timestamp": location.timestamp.timeIntervalSince1970 * 1000
      ]
    } else {
      sensorData["location"] = nil
    }

    // Accelerometer data
    if let accelData = motionManager.accelerometerData {
      sensorData["accelerometer"] = [
        "x": accelData.acceleration.x,
        "y": accelData.acceleration.y,
        "z": accelData.acceleration.z,
        "timestamp": accelData.timestamp * 1000
      ]
    } else {
      sensorData["accelerometer"] = nil
    }

    // Gyroscope data
    if let gyroData = motionManager.gyroData {
      sensorData["gyroscope"] = [
        "x": gyroData.rotationRate.x,
        "y": gyroData.rotationRate.y,
        "z": gyroData.rotationRate.z,
        "timestamp": gyroData.timestamp * 1000
      ]
    } else {
      sensorData["gyroscope"] = nil
    }

    // Compass/Magnetometer data
    if let heading = lastKnownHeading {
      sensorData["compass"] = [
        "magneticHeading": heading.magneticHeading,
        "trueHeading": heading.trueHeading,
        "headingAccuracy": heading.headingAccuracy,
        "x": heading.x,
        "y": heading.y,
        "z": heading.z,
        "timestamp": heading.timestamp.timeIntervalSince1970 * 1000
      ]
    } else {
      sensorData["compass"] = nil
    }

    // Altimeter/Barometer data
    if let altData = lastAltitudeData {
      sensorData["altimeter"] = [
        "relativeAltitude": altData.relativeAltitude.doubleValue,
        "pressure": altData.pressure.doubleValue * 10.0,
        "timestamp": Date().timeIntervalSince1970 * 1000
      ]
    } else {
      sensorData["altimeter"] = nil
    }

    // Battery data
    UIDevice.current.isBatteryMonitoringEnabled = true
    let batteryLevel = UIDevice.current.batteryLevel
    let batteryState = UIDevice.current.batteryState
    var stateString = "unknown"
    switch batteryState {
    case .unplugged: stateString = "unplugged"
    case .charging: stateString = "charging"
    case .full: stateString = "full"
    default: stateString = "unknown"
    }

    sensorData["battery"] = [
      "level": batteryLevel >= 0 ? batteryLevel : -1,
      "state": stateString,
      "isCharging": batteryState == .charging || batteryState == .full
    ]

    // Device info
    sensorData["device"] = [
      "model": UIDevice.current.model,
      "systemName": UIDevice.current.systemName,
      "systemVersion": UIDevice.current.systemVersion,
      "name": UIDevice.current.name,
      "identifier": UIDevice.current.identifierForVendor?.uuidString ?? "unknown"
    ]

    sensorData["timestamp"] = Date().timeIntervalSince1970 * 1000

    resolve(sensorData)
  }
}

// MARK: - CLLocationManagerDelegate

extension SensorDataModule: CLLocationManagerDelegate {
  func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
    if let location = locations.last {
      lastKnownLocation = location
    }
  }

  func locationManager(_ manager: CLLocationManager, didUpdateHeading newHeading: CLHeading) {
    lastKnownHeading = newHeading
  }

  func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
    print("Location manager failed with error: \(error.localizedDescription)")
  }

  func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
    let status = manager.authorizationStatus
    print("Location authorization changed: \(status.rawValue)")
  }
}

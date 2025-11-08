import Foundation
import CoreBluetooth
import React

@objc(BLEScannerModule)
class BLEScannerModule: RCTEventEmitter, CBCentralManagerDelegate {

  private var centralManager: CBCentralManager?
  private var isScanning = false
  private let phoenixCompanyID: UInt16 = 0xFFFF
  private var initializeResolve: RCTPromiseResolveBlock?
  private var initializeReject: RCTPromiseRejectBlock?

  override init() {
    super.init()
    centralManager = CBCentralManager(delegate: self, queue: nil)
  }

  override func supportedEvents() -> [String]! {
    return ["onDeviceDiscovered", "onScanFailed"]
  }

  // MARK: - React Native Methods

  @objc
  func initializeScanner(_ resolve: @escaping RCTPromiseResolveBlock,
                         rejecter reject: @escaping RCTPromiseRejectBlock) {
    guard let centralManager = centralManager else {
      reject("BLE_NOT_SUPPORTED", "Bluetooth is not supported", nil)
      return
    }

    // If state is already known (not unknown or resetting), resolve immediately
    if centralManager.state != .unknown && centralManager.state != .resetting {
      let state = getStateString(centralManager.state)
      let result: [String: Any] = [
        "state": state,
        "initialized": true
      ]
      resolve(result)
      return
    }

    // Otherwise, wait for state update
    self.initializeResolve = resolve
    self.initializeReject = reject

    // Set a timeout in case state never updates (shouldn't happen)
    DispatchQueue.main.asyncAfter(deadline: .now() + 5.0) { [weak self] in
      guard let self = self else { return }
      if self.initializeReject != nil {
        self.initializeReject?("TIMEOUT", "Bluetooth state check timed out", nil)
        self.initializeResolve = nil
        self.initializeReject = nil
      }
    }
  }

  @objc
  func startScanning(_ resolve: @escaping RCTPromiseResolveBlock,
                     rejecter reject: @escaping RCTPromiseRejectBlock) {
    guard let centralManager = centralManager else {
      reject("BLE_UNAVAILABLE", "Central manager not available", nil)
      return
    }

    if isScanning {
      reject("ALREADY_SCANNING", "Scanner is already running", nil)
      return
    }

    if centralManager.state != .poweredOn {
      reject("BLE_NOT_READY", "Bluetooth is not powered on", nil)
      return
    }

    // Scan for all devices (no service UUID filter)
    // Allow duplicates so we get RSSI updates
    let options: [String: Any] = [
      CBCentralManagerScanOptionAllowDuplicatesKey: true
    ]

    centralManager.scanForPeripherals(withServices: nil, options: options)
    isScanning = true

    let result: [String: Any] = [
      "isScanning": true,
      "status": "scanning"
    ]

    resolve(result)
  }

  @objc
  func stopScanning(_ resolve: @escaping RCTPromiseResolveBlock,
                    rejecter reject: @escaping RCTPromiseRejectBlock) {
    guard let centralManager = centralManager else {
      reject("BLE_UNAVAILABLE", "Central manager not available", nil)
      return
    }

    centralManager.stopScan()
    isScanning = false

    let result: [String: Any] = [
      "isScanning": false,
      "status": "idle"
    ]

    resolve(result)
  }

  @objc
  func getBluetoothState(_ resolve: @escaping RCTPromiseResolveBlock,
                         rejecter reject: @escaping RCTPromiseRejectBlock) {
    guard let centralManager = centralManager else {
      reject("BLE_UNAVAILABLE", "Central manager not available", nil)
      return
    }

    let state = getStateString(centralManager.state)
    let result: [String: Any] = [
      "state": state,
      "isScanning": isScanning
    ]

    resolve(result)
  }

  // MARK: - CBCentralManagerDelegate

  func centralManagerDidUpdateState(_ central: CBCentralManager) {
    let state = getStateString(central.state)

    // If we're waiting for initialization, resolve the promise
    if let resolve = self.initializeResolve, central.state != .unknown && central.state != .resetting {
      let result: [String: Any] = [
        "state": state,
        "initialized": true
      ]
      resolve(result)
      self.initializeResolve = nil
      self.initializeReject = nil
    }
  }

  func centralManager(_ central: CBCentralManager,
                     didDiscover peripheral: CBPeripheral,
                     advertisementData: [String : Any],
                     rssi RSSI: NSNumber) {

    // Extract manufacturer data
    guard let manufacturerData = advertisementData[CBAdvertisementDataManufacturerDataKey] as? Data else {
      // No manufacturer data - this is normal for many BLE devices
      return
    }

    // Manufacturer data format: first 2 bytes are company ID (little-endian)
    if manufacturerData.count < 2 {
      return
    }

    // Read company ID (little-endian)
    let companyID = manufacturerData.withUnsafeBytes { ptr -> UInt16 in
      return ptr.load(as: UInt16.self).littleEndian
    }

    // Convert manufacturer data to hex string
    let hexString = manufacturerData.map { String(format: "%02X", $0) }.joined()

    // Only log Phoenix beacons
    if companyID == phoenixCompanyID {
      sendEvent(withName: "onScanFailed", body: [
        "errorMessage": "PHOENIX BEACON DETECTED! Device: \(peripheral.name ?? "Unknown"), RSSI: \(RSSI), Company ID: 0x\(String(format: "%04X", companyID)), Data: \(hexString)"
      ])
    }

    // Create manufacturer data map
    var dataMap: [String: String] = [:]
    dataMap[String(companyID)] = hexString

    // Get device name
    let deviceName = peripheral.name ?? advertisementData[CBAdvertisementDataLocalNameKey] as? String ?? "Unknown"

    // Send event to JavaScript
    let params: [String: Any] = [
      "deviceId": peripheral.identifier.uuidString,
      "deviceName": deviceName,
      "rssi": RSSI.intValue,
      "manufacturerData": dataMap
    ]

    sendEvent(withName: "onDeviceDiscovered", body: params)
  }

  // MARK: - Helper Methods

  private func getStateString(_ state: CBManagerState) -> String {
    switch state {
    case .unknown:
      return "unknown"
    case .resetting:
      return "resetting"
    case .unsupported:
      return "unsupported"
    case .unauthorized:
      return "unauthorized"
    case .poweredOff:
      return "poweredOff"
    case .poweredOn:
      return "poweredOn"
    @unknown default:
      return "unknown"
    }
  }

  // Required for RCTEventEmitter
  override static func requiresMainQueueSetup() -> Bool {
    return true
  }
}

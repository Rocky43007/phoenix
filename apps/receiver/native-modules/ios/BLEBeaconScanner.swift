import Foundation
import React
import CoreBluetooth

@objc(BLEBeaconScanner)
class BLEBeaconScanner: RCTEventEmitter {

  private var centralManager: CBCentralManager?
  private var isScanning: Bool = false
  private var hasListeners: Bool = false

  override init() {
    super.init()
  }

  @objc
  static override func requiresMainQueueSetup() -> Bool {
    return true
  }

  override func supportedEvents() -> [String]! {
    return ["onBeaconDiscovered", "onScanningStateChange"]
  }

  override func startObserving() {
    hasListeners = true
  }

  override func stopObserving() {
    hasListeners = false
  }

  // MARK: - Initialization

  @objc
  func initializeScanner(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    DispatchQueue.main.async {
      if self.centralManager == nil {
        self.centralManager = CBCentralManager(delegate: self, queue: nil)
      }

      // Wait for state to update
      DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
        let state = self.centralManager?.state ?? .unknown
        resolve([
          "initialized": true,
          "state": self.stateToString(state)
        ])
      }
    }
  }

  // MARK: - Scanning

  @objc
  func startScanning(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    DispatchQueue.main.async {
      guard let centralManager = self.centralManager else {
        reject("NOT_INITIALIZED", "Central manager not initialized", nil)
        return
      }

      if centralManager.state != .poweredOn {
        reject("BLUETOOTH_OFF", "Bluetooth is not powered on: \(self.stateToString(centralManager.state))", nil)
        return
      }

      if self.isScanning {
        resolve(["scanning": true])
        return
      }

      // Start scanning for all devices (no service UUID filter)
      // We'll filter in the discovery callback
      // Allow duplicates to get continuous RSSI updates
      centralManager.scanForPeripherals(
        withServices: nil,
        options: [
          CBCentralManagerScanOptionAllowDuplicatesKey: true,
          CBCentralManagerScanOptionSolicitedServiceUUIDsKey: []
        ]
      )

      self.isScanning = true

      print("BLE beacon scanning started")
      NativeLogger.info("BLE beacon scanning started")

      if self.hasListeners {
        self.sendEvent(withName: "onScanningStateChange", body: [
          "scanning": true
        ])
      }

      resolve(["scanning": true])
    }
  }

  @objc
  func stopScanning(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    DispatchQueue.main.async {
      guard let centralManager = self.centralManager else {
        reject("NOT_INITIALIZED", "Central manager not initialized", nil)
        return
      }

      if !self.isScanning {
        resolve(["scanning": false])
        return
      }

      centralManager.stopScan()
      self.isScanning = false

      print("BLE beacon scanning stopped")
      NativeLogger.info("BLE beacon scanning stopped")

      if self.hasListeners {
        self.sendEvent(withName: "onScanningStateChange", body: [
          "scanning": false
        ])
      }

      resolve(["scanning": false])
    }
  }

  @objc
  func isCurrentlyScanning(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    resolve(["scanning": self.isScanning])
  }

  @objc
  func getBluetoothState(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    guard let centralManager = self.centralManager else {
      resolve(["state": "uninitialized"])
      return
    }

    resolve(["state": self.stateToString(centralManager.state)])
  }

  // MARK: - Helper Methods

  private func stateToString(_ state: CBManagerState) -> String {
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

  private func parsePhoenixBeaconData(_ manufacturerData: Data) -> [String: Any]? {
    // Manufacturer data format: [Company ID (2)] + [Magic (2)] + [Beacon data (20)] = 24 bytes

    guard manufacturerData.count >= 24 else {
      return nil
    }

    // Check Company ID (accept both 0x004C = Apple and 0x0075 = Samsung, little-endian)
    // iOS emitter uses Apple ID, Android emitter uses Samsung ID
    let companyID = UInt16(manufacturerData[0]) | (UInt16(manufacturerData[1]) << 8)
    guard companyID == 0x004C || companyID == 0x0075 else {
      return nil
    }

    // Validate exactly 24 bytes total
    guard manufacturerData.count == 24 else {
      print("Not Phoenix beacon - size: \(manufacturerData.count) bytes (expected 24)")
      return nil
    }

    // Check for Phoenix magic number (0x5048 = "PH", little-endian)
    let magic = UInt16(manufacturerData[2]) | (UInt16(manufacturerData[3]) << 8)
    guard magic == 0x5048 else {
      print("Not Phoenix beacon - magic: 0x\(String(format: "%04X", magic)) (expected 0x5048)")
      return nil
    }

    // Extract 20-byte beacon data (skip first 4 bytes: company ID + magic)
    let beaconData = manufacturerData[4..<24]

    // Convert to hex string
    let hexData = beaconData.map { String(format: "%02X", $0) }.joined()

    // Default measured power for distance estimation
    let measuredPower = -59

    return [
      "beaconData": hexData,
      "dataLength": beaconData.count,
      "measuredPower": measuredPower
    ]
  }
}

// MARK: - CBCentralManagerDelegate

extension BLEBeaconScanner: CBCentralManagerDelegate {

  func centralManagerDidUpdateState(_ central: CBCentralManager) {
    let state = stateToString(central.state)
    let stateMsg = "BLE Central Manager state changed: \(state)"
    print(stateMsg)
    NativeLogger.info(stateMsg)

    // If scanning and state changed to non-poweredOn, stop scanning
    if central.state != .poweredOn && isScanning {
      isScanning = false
      if hasListeners {
        sendEvent(withName: "onScanningStateChange", body: [
          "scanning": false
        ])
      }
    }
  }

  func centralManager(_ central: CBCentralManager, didDiscover peripheral: CBPeripheral, advertisementData: [String : Any], rssi RSSI: NSNumber) {

    // Log device to Xcode console (verbose)
    print("BLE Device: \(peripheral.name ?? "No Name") RSSI: \(RSSI)")

    if let manufacturerData = advertisementData[CBAdvertisementDataManufacturerDataKey] as? Data {
      let hexData = manufacturerData.map { String(format: "%02X", $0) }.joined()
      let companyID = manufacturerData.count >= 2 ? UInt16(manufacturerData[0]) | (UInt16(manufacturerData[1]) << 8) : 0
      print("  Company ID: 0x\(String(format: "%04X", companyID)) Data: \(hexData)")
    }

    // Extract manufacturer data
    guard let manufacturerData = advertisementData[CBAdvertisementDataManufacturerDataKey] as? Data else {
      return
    }

    // Parse Phoenix beacon data
    guard let beaconInfo = parsePhoenixBeaconData(manufacturerData) else {
      return
    }

    let beaconDetected = """

    ========================================
    *** PHOENIX BEACON DETECTED ***
    ========================================
    Device: \(peripheral.name ?? peripheral.identifier.uuidString)
    RSSI: \(RSSI) dBm
    Beacon Data: \(beaconInfo["beaconData"] ?? "")
    ========================================
    """
    print(beaconDetected)
    NativeLogger.info(beaconDetected)

    // Send event to React Native
    if hasListeners {
      sendEvent(withName: "onBeaconDiscovered", body: [
        "deviceId": peripheral.identifier.uuidString,
        "deviceName": peripheral.name ?? "Unknown",
        "beaconData": beaconInfo["beaconData"] ?? "",
        "rssi": RSSI.intValue,
        "measuredPower": beaconInfo["measuredPower"] ?? -59,
        "timestamp": Date().timeIntervalSince1970 * 1000
      ])
    }
  }
}

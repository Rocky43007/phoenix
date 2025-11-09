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
      centralManager.scanForPeripherals(
        withServices: nil,
        options: [
          CBCentralManagerScanOptionAllowDuplicatesKey: true
        ]
      )

      self.isScanning = true

      print("BLE beacon scanning started")

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

  private func parseIBeaconData(_ manufacturerData: Data) -> [String: Any]? {
    // Manufacturer data format: [Company ID (2 bytes)] + [iBeacon data]
    // iBeacon data: [Type (0x02)] + [Length (0x15)] + [UUID (16)] + [Major (2)] + [Minor (2)] + [TxPower (1)]

    guard manufacturerData.count >= 25 else {
      return nil
    }

    // Check Company ID (0x004C for Apple, little-endian)
    let companyID = UInt16(manufacturerData[0]) | (UInt16(manufacturerData[1]) << 8)
    guard companyID == 0x004C else {
      return nil
    }

    // Check iBeacon type and length
    guard manufacturerData[2] == 0x02 && manufacturerData[3] == 0x15 else {
      return nil
    }

    // Extract 20-byte beacon data from iBeacon format
    // UUID (16 bytes) + Major (2 bytes) + Minor (2 bytes) = 20 bytes
    var beaconData = Data()
    beaconData.append(manufacturerData[4..<20])  // UUID (16 bytes)
    beaconData.append(manufacturerData[20..<22]) // Major (2 bytes)
    beaconData.append(manufacturerData[22..<24]) // Minor (2 bytes)

    // Extract measured power (TX power at 1m)
    let measuredPower = Int8(bitPattern: manufacturerData[24])

    // Convert to hex string
    let hexData = beaconData.map { String(format: "%02X", $0) }.joined()

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
    print("BLE Central Manager state changed: \(state)")

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

    // Extract manufacturer data
    guard let manufacturerData = advertisementData[CBAdvertisementDataManufacturerDataKey] as? Data else {
      return
    }

    // Parse iBeacon data
    guard let beaconInfo = parseIBeaconData(manufacturerData) else {
      return
    }

    print("🔍 PHOENIX BEACON DETECTED!")
    print("  Device: \(peripheral.name ?? peripheral.identifier.uuidString)")
    print("  RSSI: \(RSSI)")
    print("  Beacon Data: \(beaconInfo["beaconData"] ?? "")")

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

import Foundation
import React
import CoreBluetooth

@objc(BLEPeripheralManager)
class BLEPeripheralManager: NSObject {

  private var peripheralManager: CBPeripheralManager?
  private var advertisingData: Data?
  private var isAdvertising: Bool = false

  override init() {
    super.init()
  }

  @objc
  static func requiresMainQueueSetup() -> Bool {
    return true // CBPeripheralManager requires main queue
  }

  // MARK: - Initialization

  @objc
  func initializePeripheral(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    DispatchQueue.main.async {
      if self.peripheralManager == nil {
        // Create peripheral manager with main queue
        self.peripheralManager = CBPeripheralManager(delegate: self, queue: nil)
      }

      // Wait a moment for state to update
      DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
        let state = self.peripheralManager?.state ?? .unknown
        resolve([
          "initialized": true,
          "state": self.stateToString(state)
        ])
      }
    }
  }

  // MARK: - Advertising

  @objc
  func startAdvertising(_ beaconData: String,
                        resolver resolve: @escaping RCTPromiseResolveBlock,
                        rejecter reject: @escaping RCTPromiseRejectBlock) {
    DispatchQueue.main.async {
      guard let peripheralManager = self.peripheralManager else {
        reject("NOT_INITIALIZED", "Peripheral manager not initialized", nil)
        return
      }

      // Check Bluetooth state
      if peripheralManager.state != .poweredOn {
        reject("BLUETOOTH_OFF", "Bluetooth is not powered on: \(self.stateToString(peripheralManager.state))", nil)
        return
      }

      // Stop any existing advertising
      if self.isAdvertising {
        peripheralManager.stopAdvertising()
      }

      // Convert hex string to Data
      guard let data = self.hexStringToData(beaconData) else {
        reject("INVALID_DATA", "Invalid beacon data format", nil)
        return
      }

      self.advertisingData = data

      // Company identifier for manufacturer data (using a test company ID)
      // In production, you should register for an official company ID
      let companyID: UInt16 = 0xFFFF // Test/development company ID

      // Build manufacturer data: [company ID (2 bytes little-endian)] + [beacon data (22 bytes)]
      var manufacturerData = Data()
      manufacturerData.append(UInt8(companyID & 0xFF))
      manufacturerData.append(UInt8((companyID >> 8) & 0xFF))
      manufacturerData.append(data)

      // Create advertising data
      let advertisementData: [String: Any] = [
        CBAdvertisementDataManufacturerDataKey: manufacturerData,
        CBAdvertisementDataLocalNameKey: "Phoenix-Beacon"
      ]

      // Start advertising
      peripheralManager.startAdvertising(advertisementData)
      self.isAdvertising = true

      print("Started BLE advertising with \(data.count) bytes of beacon data")
      print("Manufacturer data: \(manufacturerData.map { String(format: "%02X", $0) }.joined())")

      resolve([
        "advertising": true,
        "dataLength": data.count
      ])
    }
  }

  @objc
  func stopAdvertising(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    DispatchQueue.main.async {
      guard let peripheralManager = self.peripheralManager else {
        reject("NOT_INITIALIZED", "Peripheral manager not initialized", nil)
        return
      }

      if self.isAdvertising {
        peripheralManager.stopAdvertising()
        self.isAdvertising = false
        print("Stopped BLE advertising")
      }

      resolve([
        "advertising": false
      ])
    }
  }

  @objc
  func isCurrentlyAdvertising(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    resolve([
      "advertising": self.isAdvertising
    ])
  }

  @objc
  func getBluetoothState(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    guard let peripheralManager = self.peripheralManager else {
      resolve([
        "state": "uninitialized"
      ])
      return
    }

    resolve([
      "state": self.stateToString(peripheralManager.state)
    ])
  }

  // MARK: - Helper Methods

  private func hexStringToData(_ hexString: String) -> Data? {
    var hex = hexString
    // Remove any spaces or colons
    hex = hex.replacingOccurrences(of: " ", with: "")
    hex = hex.replacingOccurrences(of: ":", with: "")

    // Ensure even length
    if hex.count % 2 != 0 {
      return nil
    }

    var data = Data()
    var index = hex.startIndex

    while index < hex.endIndex {
      let nextIndex = hex.index(index, offsetBy: 2)
      let byteString = hex[index..<nextIndex]

      guard let byte = UInt8(byteString, radix: 16) else {
        return nil
      }

      data.append(byte)
      index = nextIndex
    }

    return data
  }

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
}

// MARK: - CBPeripheralManagerDelegate

extension BLEPeripheralManager: CBPeripheralManagerDelegate {

  func peripheralManagerDidUpdateState(_ peripheral: CBPeripheralManager) {
    let state = stateToString(peripheral.state)
    print("BLE Peripheral Manager state changed: \(state)")

    // If we were advertising and state changed, handle it
    if peripheral.state != .poweredOn && isAdvertising {
      isAdvertising = false
      print("Advertising stopped due to state change")
    }
  }

  func peripheralManagerDidStartAdvertising(_ peripheral: CBPeripheralManager, error: Error?) {
    if let error = error {
      print("Error starting advertising: \(error.localizedDescription)")
      isAdvertising = false
    } else {
      print("Successfully started advertising")
      isAdvertising = true
    }
  }
}

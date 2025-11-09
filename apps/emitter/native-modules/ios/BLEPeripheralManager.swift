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

      // Validate beacon data is 20 bytes
      if data.count != 20 {
        reject("INVALID_DATA", "Beacon data must be 20 bytes, got \(data.count)", nil)
        return
      }

      self.advertisingData = data

      // Use Apple's company ID (0x004C) - required for iOS to actually broadcast manufacturer data
      // We use our own custom format with Phoenix magic number
      let companyID: UInt16 = 0x004C
      let phoenixMagic: UInt16 = 0x5048 // "PH" - Phoenix beacon identifier

      // Build manufacturer data: [company ID (2)] + [magic (2)] + [beacon data (20)]
      // iOS requires company ID to be included in the data
      var manufacturerData = Data()
      let companyIDLowByte = UInt8(companyID & 0xFF)
      let companyIDHighByte = UInt8((companyID >> 8) & 0xFF)
      let magicLowByte = UInt8(phoenixMagic & 0xFF)
      let magicHighByte = UInt8((phoenixMagic >> 8) & 0xFF)

      manufacturerData.append(companyIDLowByte)
      manufacturerData.append(companyIDHighByte)
      manufacturerData.append(magicLowByte)
      manufacturerData.append(magicHighByte)
      manufacturerData.append(contentsOf: data)

      // Detailed logging
      let logMessage = """

      ========================================
      PREPARING TO BROADCAST PHOENIX BEACON
      ========================================
      Company ID: 0x\(String(format: "%04X", companyID))
      Phoenix Magic: 0x\(String(format: "%04X", phoenixMagic)) ("PH")
      Beacon data length: \(data.count) bytes
      Beacon data: \(data.map { String(format: "%02X", $0) }.joined())
      Manufacturer data length: \(manufacturerData.count) bytes
      Full manufacturer data: \(manufacturerData.map { String(format: "%02X", $0) }.joined())
      Format: [CompanyID:2] [Magic:2] [Data:20] = 24 bytes
      ========================================
      """
      print(logMessage)
      NativeLogger.info(logMessage)

      // Create advertising data
      // NOTE: BLE advertising packet limited to 31 bytes total!
      // Manufacturer data (~27 bytes) leaves only ~4 bytes for name
      // Solution: Remove local name to prioritize manufacturer data
      let advertisementData: [String: Any] = [
        // CBAdvertisementDataLocalNameKey: "PHX", // Removed - causes manufacturer data to be dropped
        CBAdvertisementDataManufacturerDataKey: manufacturerData
      ]

      // Start advertising
      peripheralManager.startAdvertising(advertisementData)
      self.isAdvertising = true

      print("Started Phoenix beacon advertising with \(data.count) bytes of beacon data")

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
      let errorMessage = """

      ========================================
      ADVERTISING FAILED TO START
      ========================================
      Error: \(error.localizedDescription)
      ========================================
      """
      print(errorMessage)
      NativeLogger.error(errorMessage)
      isAdvertising = false
    } else {
      let successMessage = """

      ========================================
      ADVERTISING STARTED SUCCESSFULLY
      ========================================
      Phoenix beacon is now broadcasting!
      Company ID: 0x004C (Apple - required for iOS)
      Data format: Custom 20-byte (not iBeacon)
      ========================================
      """
      print(successMessage)
      NativeLogger.info(successMessage)
      isAdvertising = true
    }
  }
}

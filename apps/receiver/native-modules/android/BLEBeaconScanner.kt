package com.phoenix.receiver

import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothManager
import android.bluetooth.le.BluetoothLeScanner
import android.bluetooth.le.ScanCallback
import android.bluetooth.le.ScanResult
import android.bluetooth.le.ScanSettings
import android.content.Context
import android.util.Log
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule

class BLEBeaconScanner(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    private var bluetoothAdapter: BluetoothAdapter? = null
    private var bluetoothLeScanner: BluetoothLeScanner? = null
    private var isScanning = false
    private val reactApplicationContext: ReactApplicationContext = reactContext

    companion object {
        private const val TAG = "BLEBeaconScanner"
        private const val PHOENIX_COMPANY_ID_SAMSUNG = 0x0075 // Samsung (Android emitter)
        private const val PHOENIX_COMPANY_ID_APPLE = 0x004C // Apple (iOS emitter)
    }

    override fun getName(): String {
        return "BLEBeaconScanner"
    }

    init {
        val bluetoothManager =
            reactContext.getSystemService(Context.BLUETOOTH_SERVICE) as BluetoothManager
        bluetoothAdapter = bluetoothManager.adapter
        bluetoothLeScanner = bluetoothAdapter?.bluetoothLeScanner
    }

    private val scanCallback = object : ScanCallback() {
        override fun onScanResult(callbackType: Int, result: ScanResult) {
            super.onScanResult(callbackType, result)
            processScanResult(result)
        }

        override fun onBatchScanResults(results: MutableList<ScanResult>) {
            super.onBatchScanResults(results)
            for (result in results) {
                processScanResult(result)
            }
        }

        override fun onScanFailed(errorCode: Int) {
            super.onScanFailed(errorCode)
            isScanning = false
            val errorMsg = "BLE scan failed: ${getScanErrorMessage(errorCode)}"
            Log.e(TAG, errorMsg)
            NativeLogger.error(TAG, errorMsg)

            sendEvent("onScanningStateChange", Arguments.createMap().apply {
                putBoolean("scanning", false)
                putString("error", getScanErrorMessage(errorCode))
            })
        }
    }

    @ReactMethod
    fun initializeScanner(promise: Promise) {
        try {
            if (bluetoothAdapter == null) {
                promise.reject("BLE_NOT_SUPPORTED", "Bluetooth is not supported on this device")
                return
            }

            if (!bluetoothAdapter!!.isEnabled) {
                promise.reject("BLE_DISABLED", "Bluetooth is disabled")
                return
            }

            if (bluetoothLeScanner == null) {
                promise.reject("BLE_SCANNER_UNAVAILABLE", "BLE scanner is not available")
                return
            }

            val result = Arguments.createMap().apply {
                putString("state", "poweredOn")
                putBoolean("initialized", true)
            }

            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("INIT_ERROR", "Failed to initialize scanner: ${e.message}")
        }
    }

    @ReactMethod
    fun startScanning(promise: Promise) {
        try {
            if (isScanning) {
                promise.resolve(Arguments.createMap().apply {
                    putBoolean("scanning", true)
                })
                return
            }

            if (bluetoothLeScanner == null) {
                promise.reject("BLE_UNAVAILABLE", "BLE scanner is not available")
                return
            }

            // Configure scan settings for optimal performance
            val settings = ScanSettings.Builder()
                .setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY) // Most responsive
                .setReportDelay(0) // Report immediately, no batching
                .setCallbackType(ScanSettings.CALLBACK_TYPE_ALL_MATCHES) // Report all matches
                .setMatchMode(ScanSettings.MATCH_MODE_AGGRESSIVE) // More aggressive matching
                .setNumOfMatches(ScanSettings.MATCH_NUM_MAX_ADVERTISEMENT) // Max advertisements
                .build()

            // Start scanning (no filters - we'll filter in callback)
            bluetoothLeScanner!!.startScan(null, settings, scanCallback)
            isScanning = true

            Log.d(TAG, "BLE beacon scanning started")
            NativeLogger.info(TAG, "BLE beacon scanning started")

            sendEvent("onScanningStateChange", Arguments.createMap().apply {
                putBoolean("scanning", true)
            })

            promise.resolve(Arguments.createMap().apply {
                putBoolean("scanning", true)
            })

        } catch (e: SecurityException) {
            promise.reject("PERMISSION_DENIED", "Bluetooth permissions not granted: ${e.message}")
        } catch (e: Exception) {
            promise.reject("SCAN_ERROR", "Failed to start scanning: ${e.message}")
        }
    }

    @ReactMethod
    fun stopScanning(promise: Promise) {
        try {
            if (!isScanning) {
                promise.resolve(Arguments.createMap().apply {
                    putBoolean("scanning", false)
                })
                return
            }

            bluetoothLeScanner?.stopScan(scanCallback)
            isScanning = false

            Log.d(TAG, "BLE beacon scanning stopped")
            NativeLogger.info(TAG, "BLE beacon scanning stopped")

            sendEvent("onScanningStateChange", Arguments.createMap().apply {
                putBoolean("scanning", false)
            })

            promise.resolve(Arguments.createMap().apply {
                putBoolean("scanning", false)
            })

        } catch (e: Exception) {
            promise.reject("STOP_ERROR", "Failed to stop scanning: ${e.message}")
        }
    }

    @ReactMethod
    fun isCurrentlyScanning(promise: Promise) {
        promise.resolve(Arguments.createMap().apply {
            putBoolean("scanning", isScanning)
        })
    }

    @ReactMethod
    fun getBluetoothState(promise: Promise) {
        try {
            val state = when {
                bluetoothAdapter == null -> "unsupported"
                !bluetoothAdapter!!.isEnabled -> "poweredOff"
                else -> "poweredOn"
            }

            val result = Arguments.createMap().apply {
                putString("state", state)
                putBoolean("scanning", isScanning)
            }

            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("STATE_ERROR", "Failed to get Bluetooth state: ${e.message}")
        }
    }

    // Required for New Architecture event emitter
    @ReactMethod
    fun addListener(eventName: String) {
        // Keep: Required for RN built-in Event Emitter Calls
    }

    @ReactMethod
    fun removeListeners(count: Int) {
        // Keep: Required for RN built-in Event Emitter Calls
    }

    private fun processScanResult(result: ScanResult) {
        try {
            val scanRecord = result.scanRecord ?: return

            // Log ALL discovered BLE devices to native logcat only (verbose)
            val deviceInfo = buildString {
                append("BLE Device Discovered:\n")
                append("  Name: ${result.device.name ?: "No Name"}\n")
                append("  Address: ${result.device.address}\n")
                append("  RSSI: ${result.rssi}")
            }
            Log.d(TAG, deviceInfo)

            val manufacturerData = scanRecord.manufacturerSpecificData

            // Check if manufacturer data exists
            if (manufacturerData == null || manufacturerData.size() == 0) {
                Log.d(TAG, "  No manufacturer data")
                return
            }

            // Log manufacturer data
            val mfgInfo = buildString {
                append("  Manufacturer Data:")
                for (i in 0 until manufacturerData.size()) {
                    val companyId = manufacturerData.keyAt(i)
                    val data = manufacturerData.valueAt(i)
                    val hexData = data.joinToString("") { String.format("%02X", it) }
                    append("\n    Company ID: 0x${String.format("%04X", companyId)} Data: $hexData")
                }
            }
            Log.d(TAG, mfgInfo)

            // Look for Phoenix beacon in Samsung (Android) or Apple (iOS) manufacturer data
            val phoenixData = manufacturerData.get(PHOENIX_COMPANY_ID_SAMSUNG)
                ?: manufacturerData.get(PHOENIX_COMPANY_ID_APPLE)
                ?: return

            // Validate Phoenix beacon format: magic (2 bytes) + data (20 bytes) = 22 bytes
            if (phoenixData.size != 22) {
                Log.d(TAG, "Not Phoenix beacon - size: ${phoenixData.size} bytes (expected 22)")
                return
            }

            // Check for Phoenix magic number (0x5048 = "PH")
            val magic = ((phoenixData[1].toInt() and 0xFF) shl 8) or (phoenixData[0].toInt() and 0xFF)
            if (magic != 0x5048) {
                Log.d(TAG, "Not Phoenix beacon - magic: 0x${String.format("%04X", magic)} (expected 0x5048)")
                return
            }

            val beaconDetected = buildString {
                append("\n========================================\n")
                append("*** PHOENIX BEACON DETECTED ***\n")
                append("========================================\n")
                append("Device: ${result.device.name ?: result.device.address}\n")
                append("RSSI: ${result.rssi} dBm")
            }
            Log.d(TAG, beaconDetected)
            NativeLogger.info(TAG, beaconDetected)

            // Extract the 20-byte beacon data (skip first 2 bytes which are magic)
            val beaconDataBytes = ByteArray(20)
            System.arraycopy(phoenixData, 2, beaconDataBytes, 0, 20)

            // For distance estimation, use a default measured power
            // This can be calibrated later or added to the beacon format
            val measuredPower = -59 // Default RSSI at 1 meter

            // Convert to hex string
            val hexData = beaconDataBytes.joinToString("") { String.format("%02X", it) }

            Log.d(TAG, "  Beacon Data: $hexData")
            NativeLogger.info(TAG, "  Beacon Data: $hexData")

            // Send event to React Native
            val event = Arguments.createMap().apply {
                putString("deviceId", result.device.address)
                putString("deviceName", result.device.name ?: result.device.address)
                putString("beaconData", hexData)
                putInt("rssi", result.rssi)
                putInt("measuredPower", measuredPower)
                putDouble("timestamp", System.currentTimeMillis().toDouble())
            }

            sendEvent("onBeaconDiscovered", event)

        } catch (e: Exception) {
            val errorMsg = "Error processing scan result: ${e.message}"
            Log.e(TAG, errorMsg)
            NativeLogger.error(TAG, errorMsg)
        }
    }

    private fun sendEvent(eventName: String, params: WritableMap) {
        reactApplicationContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(eventName, params)
    }

    private fun getScanErrorMessage(errorCode: Int): String {
        return when (errorCode) {
            ScanCallback.SCAN_FAILED_ALREADY_STARTED -> "Scan already started"
            ScanCallback.SCAN_FAILED_APPLICATION_REGISTRATION_FAILED -> "App registration failed"
            ScanCallback.SCAN_FAILED_INTERNAL_ERROR -> "Internal error"
            ScanCallback.SCAN_FAILED_FEATURE_UNSUPPORTED -> "Feature not supported"
            else -> "Unknown error: $errorCode"
        }
    }
}

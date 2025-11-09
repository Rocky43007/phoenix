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
        private const val IBEACON_COMPANY_ID = 0x004C // Apple Inc.
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
            Log.e(TAG, "BLE scan failed: ${getScanErrorMessage(errorCode)}")

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

            // Configure scan settings for low latency (better detection)
            val settings = ScanSettings.Builder()
                .setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY)
                .setReportDelay(0) // Report immediately, don't batch
                .build()

            // Start scanning (no filters - we'll filter in callback)
            bluetoothLeScanner!!.startScan(null, settings, scanCallback)
            isScanning = true

            Log.d(TAG, "BLE beacon scanning started")

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

    private fun processScanResult(result: ScanResult) {
        try {
            val scanRecord = result.scanRecord ?: return
            val manufacturerData = scanRecord.manufacturerSpecificData

            // Look for Apple company ID (0x004C)
            val ibeaconData = manufacturerData.get(IBEACON_COMPANY_ID) ?: return

            // Validate iBeacon format: Type(0x02) + Length(0x15) = 23 bytes total
            if (ibeaconData.size < 23) {
                return
            }

            // Check iBeacon type and length
            if (ibeaconData[0] != 0x02.toByte() || ibeaconData[1] != 0x15.toByte()) {
                return
            }

            Log.d(TAG, "🔍 PHOENIX BEACON DETECTED!")
            Log.d(TAG, "  Device: ${result.device.name ?: result.device.address}")
            Log.d(TAG, "  RSSI: ${result.rssi}")

            // Extract 20-byte beacon data from iBeacon format
            // Format: [Type(1)] + [Length(1)] + [UUID(16)] + [Major(2)] + [Minor(2)] + [TxPower(1)]
            val beaconDataBytes = ByteArray(20)

            // Copy UUID (16 bytes)
            System.arraycopy(ibeaconData, 2, beaconDataBytes, 0, 16)

            // Copy Major (2 bytes)
            System.arraycopy(ibeaconData, 18, beaconDataBytes, 16, 2)

            // Copy Minor (2 bytes)
            System.arraycopy(ibeaconData, 20, beaconDataBytes, 18, 2)

            // Extract measured power (TX power at 1m)
            val measuredPower = ibeaconData[22].toInt()

            // Convert to hex string
            val hexData = beaconDataBytes.joinToString("") { String.format("%02X", it) }

            Log.d(TAG, "  Beacon Data: $hexData")

            // Send event to React Native
            val event = Arguments.createMap().apply {
                putString("deviceId", result.device.address)
                putString("deviceName", result.device.name ?: "Unknown")
                putString("beaconData", hexData)
                putInt("rssi", result.rssi)
                putInt("measuredPower", measuredPower)
                putDouble("timestamp", System.currentTimeMillis().toDouble())
            }

            sendEvent("onBeaconDiscovered", event)

        } catch (e: Exception) {
            Log.e(TAG, "Error processing scan result: ${e.message}")
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

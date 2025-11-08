package com.rocky43007.receiver

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

class BLEScannerModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    private var bluetoothAdapter: BluetoothAdapter? = null
    private var bluetoothLeScanner: BluetoothLeScanner? = null
    private var isScanning = false

    companion object {
        private const val TAG = "BLEScannerModule"
    }

    override fun getName(): String {
        return "BLEScannerModule"
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
            handleScanResult(result)
        }

        override fun onBatchScanResults(results: List<ScanResult>) {
            super.onBatchScanResults(results)
            results.forEach { handleScanResult(it) }
        }

        override fun onScanFailed(errorCode: Int) {
            super.onScanFailed(errorCode)
            isScanning = false
            Log.e(TAG, "BLE scan failed: ${getScanErrorMessage(errorCode)}")

            sendEvent("onScanFailed", Arguments.createMap().apply {
                putInt("errorCode", errorCode)
                putString("errorMessage", getScanErrorMessage(errorCode))
            })
        }
    }

    private fun handleScanResult(result: ScanResult) {
        val device = result.device
        val scanRecord = result.scanRecord ?: return

        // Extract manufacturer data
        val manufacturerData = scanRecord.manufacturerSpecificData
        if (manufacturerData.size() == 0) {
            return
        }

        // Convert manufacturer data to map
        val dataMap = Arguments.createMap()
        for (i in 0 until manufacturerData.size()) {
            val companyId = manufacturerData.keyAt(i)
            val data = manufacturerData.valueAt(i)

            // Convert to hex string
            val hexString = data.joinToString("") { String.format("%02X", it) }
            dataMap.putString(companyId.toString(), hexString)

            // Log Phoenix beacons only
            if (companyId == 0xFFFF) {
                Log.d(TAG, "PHOENIX BEACON DETECTED! Device: ${device.name ?: "Unknown"}, RSSI: ${result.rssi}, Data: $hexString")
            }
        }

        // Send device discovered event
        val params = Arguments.createMap().apply {
            putString("deviceId", device.address)
            putString("deviceName", device.name ?: "Unknown")
            putInt("rssi", result.rssi)
            putMap("manufacturerData", dataMap)
        }

        sendEvent("onDeviceDiscovered", params)
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
                promise.reject("ALREADY_SCANNING", "Already scanning")
                return
            }

            if (bluetoothLeScanner == null) {
                promise.reject("BLE_UNAVAILABLE", "BLE scanner is not available")
                return
            }

            // Configure scan settings
            val settings = ScanSettings.Builder()
                .setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY)
                .setReportDelay(0)
                .build()

            // Start scanning
            bluetoothLeScanner!!.startScan(null, settings, scanCallback)
            isScanning = true

            Log.d(TAG, "BLE scanning started")

            val result = Arguments.createMap().apply {
                putBoolean("isScanning", true)
                putString("status", "scanning")
            }

            promise.resolve(result)
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
                    putBoolean("isScanning", false)
                    putString("status", "idle")
                })
                return
            }

            bluetoothLeScanner?.stopScan(scanCallback)
            isScanning = false

            Log.d(TAG, "BLE scanning stopped")

            val result = Arguments.createMap().apply {
                putBoolean("isScanning", false)
                putString("status", "idle")
            }

            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("STOP_ERROR", "Failed to stop scanning: ${e.message}")
        }
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
                putBoolean("isScanning", isScanning)
            }

            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("STATE_ERROR", "Failed to get Bluetooth state: ${e.message}")
        }
    }

    private fun sendEvent(eventName: String, params: WritableMap?) {
        reactApplicationContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(eventName, params)
    }

    private fun getScanErrorMessage(errorCode: Int): String {
        return when (errorCode) {
            ScanCallback.SCAN_FAILED_ALREADY_STARTED -> "Scan already started"
            ScanCallback.SCAN_FAILED_APPLICATION_REGISTRATION_FAILED -> "Application registration failed"
            ScanCallback.SCAN_FAILED_FEATURE_UNSUPPORTED -> "Feature not supported"
            ScanCallback.SCAN_FAILED_INTERNAL_ERROR -> "Internal error"
            else -> "Unknown error: $errorCode"
        }
    }
}

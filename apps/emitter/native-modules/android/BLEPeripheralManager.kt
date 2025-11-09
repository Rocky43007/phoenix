package com.rocky43007.emitter

import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothManager
import android.bluetooth.le.AdvertiseCallback
import android.bluetooth.le.AdvertiseData
import android.bluetooth.le.AdvertiseSettings
import android.bluetooth.le.BluetoothLeAdvertiser
import android.content.Context
import android.os.ParcelUuid
import android.util.Log
import com.facebook.react.bridge.*

class BLEPeripheralManager(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    private var bluetoothAdapter: BluetoothAdapter? = null
    private var bluetoothLeAdvertiser: BluetoothLeAdvertiser? = null
    private var isAdvertising = false

    companion object {
        private const val TAG = "BLEPeripheralManager"
    }

    override fun getName(): String {
        return "BLEPeripheralManager"
    }

    init {
        val bluetoothManager =
            reactContext.getSystemService(Context.BLUETOOTH_SERVICE) as BluetoothManager
        bluetoothAdapter = bluetoothManager.adapter
        bluetoothLeAdvertiser = bluetoothAdapter?.bluetoothLeAdvertiser
    }

    private val advertiseCallback = object : AdvertiseCallback() {
        override fun onStartSuccess(settingsInEffect: AdvertiseSettings) {
            super.onStartSuccess(settingsInEffect)
            isAdvertising = true
            val successMessage = buildString {
                append("\n========================================\n")
                append("ADVERTISING STARTED SUCCESSFULLY\n")
                append("========================================\n")
                append("Phoenix beacon is now broadcasting!\n")
                append("Company ID: 0x0075 (Samsung)\n")
                append("Data format: Custom 20-byte (not iBeacon)\n")
                append("TX Power: ${settingsInEffect.txPowerLevel}\n")
                append("Mode: ${settingsInEffect.mode}\n")
                append("========================================")
            }
            Log.d(TAG, successMessage)
            NativeLogger.info(TAG, successMessage)
        }

        override fun onStartFailure(errorCode: Int) {
            super.onStartFailure(errorCode)
            isAdvertising = false
            val errorMessage = buildString {
                append("\n========================================\n")
                append("ADVERTISING FAILED TO START\n")
                append("========================================\n")
                append("Error: ${getAdvertiseErrorMessage(errorCode)}\n")
                append("========================================")
            }
            Log.e(TAG, errorMessage)
            NativeLogger.error(TAG, errorMessage)
        }
    }

    @ReactMethod
    fun initializePeripheral(promise: Promise) {
        try {
            if (bluetoothAdapter == null) {
                promise.reject("BLE_NOT_SUPPORTED", "Bluetooth is not supported on this device")
                return
            }

            if (!bluetoothAdapter!!.isEnabled) {
                promise.reject("BLE_DISABLED", "Bluetooth is disabled")
                return
            }

            if (bluetoothLeAdvertiser == null) {
                promise.reject("BLE_ADVERTISER_UNAVAILABLE", "BLE advertiser is not available")
                return
            }

            val result = Arguments.createMap().apply {
                putString("state", "poweredOn")
                putBoolean("initialized", true)
            }

            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("INIT_ERROR", "Failed to initialize peripheral: ${e.message}")
        }
    }

    @ReactMethod
    fun startAdvertising(beaconDataHex: String, promise: Promise) {
        try {
            if (bluetoothLeAdvertiser == null) {
                promise.reject("BLE_UNAVAILABLE", "BLE advertiser is not available")
                return
            }

            // Force stop any existing advertising first
            try {
                bluetoothLeAdvertiser!!.stopAdvertising(advertiseCallback)
                Thread.sleep(100) // Give it time to stop
            } catch (e: Exception) {
                Log.d(TAG, "Stop advertising (expected if not running): ${e.message}")
            }

            // Convert hex string to byte array
            val beaconData = hexStringToByteArray(beaconDataHex)

            if (beaconData.size != 20) {
                promise.reject("INVALID_DATA", "Beacon data must be 20 bytes, got ${beaconData.size}")
                return
            }

            // Use Samsung's company ID (0x0075) for better Android compatibility
            val companyId = 0x0075
            val phoenixMagic = 0x5048 // "PH" - Phoenix beacon identifier

            // Build manufacturer data: [magic (2 bytes)] + [beacon data (20 bytes)]
            // Total: 22 bytes (company ID is added automatically by Android API)
            val manufacturerData = ByteArray(22)
            manufacturerData[0] = (phoenixMagic and 0xFF).toByte()
            manufacturerData[1] = ((phoenixMagic shr 8) and 0xFF).toByte()
            System.arraycopy(beaconData, 0, manufacturerData, 2, 20)

            val logMessage = buildString {
                append("\n========================================\n")
                append("PREPARING TO BROADCAST PHOENIX BEACON\n")
                append("========================================\n")
                append("Company ID: 0x${String.format("%04X", companyId)}\n")
                append("Phoenix Magic: 0x${String.format("%04X", phoenixMagic)} (\"PH\")\n")
                append("Beacon data length: ${beaconData.size} bytes\n")
                append("Beacon data: ${beaconData.joinToString("") { String.format("%02X", it) }}\n")
                append("Manufacturer data: ${manufacturerData.joinToString("") { String.format("%02X", it) }}\n")
                append("Format: [Magic:2] [Data:20] = 22 bytes\n")
                append("========================================")
            }
            Log.d(TAG, logMessage)
            NativeLogger.info(TAG, logMessage)

            // Configure advertising settings
            val settings = AdvertiseSettings.Builder()
                .setAdvertiseMode(AdvertiseSettings.ADVERTISE_MODE_LOW_LATENCY)
                .setTxPowerLevel(AdvertiseSettings.ADVERTISE_TX_POWER_HIGH)
                .setConnectable(false)
                .build()

            // Configure advertising data with Phoenix beacon format
            // NOTE: Advertising packet limited to 31 bytes
            // Manufacturer data takes ~26 bytes, so NO room for device name
            val advertiseData = AdvertiseData.Builder()
                .addManufacturerData(companyId, manufacturerData)
                .setIncludeDeviceName(false)  // No name - exceeds 31-byte limit
                .build()

            // Set scan response with device name (separate 31-byte packet)
            val scanResponse = AdvertiseData.Builder()
                .setIncludeDeviceName(true)  // Phone's Bluetooth name goes here
                .build()

            // Start advertising with scan response
            bluetoothLeAdvertiser!!.startAdvertising(settings, advertiseData, scanResponse, advertiseCallback)

            val result = Arguments.createMap().apply {
                putBoolean("isAdvertising", true)
                putString("status", "advertising")
            }

            promise.resolve(result)
        } catch (e: SecurityException) {
            promise.reject("PERMISSION_DENIED", "Bluetooth permissions not granted: ${e.message}")
        } catch (e: Exception) {
            promise.reject("ADVERTISE_ERROR", "Failed to start advertising: ${e.message}")
        }
    }

    @ReactMethod
    fun stopAdvertising(promise: Promise) {
        try {
            if (!isAdvertising) {
                promise.resolve(Arguments.createMap().apply {
                    putBoolean("isAdvertising", false)
                    putString("status", "idle")
                })
                return
            }

            bluetoothLeAdvertiser?.stopAdvertising(advertiseCallback)
            isAdvertising = false

            val result = Arguments.createMap().apply {
                putBoolean("isAdvertising", false)
                putString("status", "idle")
            }

            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("STOP_ERROR", "Failed to stop advertising: ${e.message}")
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
                putBoolean("isAdvertising", isAdvertising)
            }

            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("STATE_ERROR", "Failed to get Bluetooth state: ${e.message}")
        }
    }

    private fun hexStringToByteArray(hex: String): ByteArray {
        val cleanHex = hex.replace(" ", "").uppercase()
        return ByteArray(cleanHex.length / 2) { i ->
            cleanHex.substring(i * 2, i * 2 + 2).toInt(16).toByte()
        }
    }

    private fun getAdvertiseErrorMessage(errorCode: Int): String {
        return when (errorCode) {
            AdvertiseCallback.ADVERTISE_FAILED_DATA_TOO_LARGE -> "Data too large"
            AdvertiseCallback.ADVERTISE_FAILED_TOO_MANY_ADVERTISERS -> "Too many advertisers"
            AdvertiseCallback.ADVERTISE_FAILED_ALREADY_STARTED -> "Already started"
            AdvertiseCallback.ADVERTISE_FAILED_INTERNAL_ERROR -> "Internal error"
            AdvertiseCallback.ADVERTISE_FAILED_FEATURE_UNSUPPORTED -> "Feature not supported"
            else -> "Unknown error: $errorCode"
        }
    }
}

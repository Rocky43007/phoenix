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
            Log.d(TAG, "BLE advertising started successfully")
        }

        override fun onStartFailure(errorCode: Int) {
            super.onStartFailure(errorCode)
            isAdvertising = false
            Log.e(TAG, "BLE advertising failed: ${getAdvertiseErrorMessage(errorCode)}")
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
            if (isAdvertising) {
                promise.reject("ALREADY_ADVERTISING", "Already advertising")
                return
            }

            if (bluetoothLeAdvertiser == null) {
                promise.reject("BLE_UNAVAILABLE", "BLE advertiser is not available")
                return
            }

            // Convert hex string to byte array
            val beaconData = hexStringToByteArray(beaconDataHex)

            if (beaconData.size != 20) {
                promise.reject("INVALID_DATA", "Beacon data must be 20 bytes, got ${beaconData.size}")
                return
            }

            // Use Apple's company ID for iBeacon compatibility
            val companyId = 0x004C

            // Format as iBeacon: [Type(0x02), Length(0x15), UUID(16), Major(2), Minor(2), TxPower(1)]
            val ibeaconData = ByteArray(23)

            // iBeacon type and length
            ibeaconData[0] = 0x02.toByte()
            ibeaconData[1] = 0x15.toByte()

            // UUID (16 bytes): first 16 bytes of beacon data
            System.arraycopy(beaconData, 0, ibeaconData, 2, 16)

            // Major (2 bytes): bytes 16-17 of beacon data
            System.arraycopy(beaconData, 16, ibeaconData, 18, 2)

            // Minor (2 bytes): bytes 18-19 of beacon data
            System.arraycopy(beaconData, 18, ibeaconData, 20, 2)

            // Measured Power (-59 dBm at 1m)
            ibeaconData[22] = (-59).toByte()

            Log.d(TAG, "iBeacon data: ${ibeaconData.joinToString("") { String.format("%02X", it) }}")

            // Configure advertising settings
            val settings = AdvertiseSettings.Builder()
                .setAdvertiseMode(AdvertiseSettings.ADVERTISE_MODE_LOW_LATENCY)
                .setTxPowerLevel(AdvertiseSettings.ADVERTISE_TX_POWER_HIGH)
                .setConnectable(false)
                .build()

            // Configure advertising data with iBeacon format
            // Note: NOT including device name to stay within 31-byte BLE advertisement limit
            val advertiseData = AdvertiseData.Builder()
                .addManufacturerData(companyId, ibeaconData)
                .setIncludeDeviceName(false)
                .build()

            // Start advertising
            bluetoothLeAdvertiser!!.startAdvertising(settings, advertiseData, advertiseCallback)

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

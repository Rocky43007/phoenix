package com.rocky43007.emitter

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.BatteryManager
import android.os.Build
import android.util.Log
import androidx.core.app.ActivityCompat
import com.facebook.react.bridge.*

class SensorDataModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    private val sensorManager: SensorManager = reactContext.getSystemService(Context.SENSOR_SERVICE) as SensorManager
    private val locationManager: LocationManager = reactContext.getSystemService(Context.LOCATION_SERVICE) as LocationManager
    private val batteryManager: BatteryManager = reactContext.getSystemService(Context.BATTERY_SERVICE) as BatteryManager

    private var currentLocation: Location? = null
    private var accelerometerData: FloatArray? = null
    private var gyroscopeData: FloatArray? = null
    private var magnetometerData: FloatArray? = null
    private var pressureData: Float? = null

    companion object {
        private const val TAG = "SensorDataModule"
    }

    override fun getName(): String {
        return "SensorDataModule"
    }

    // Location listener
    private val locationListener = LocationListener { location ->
        currentLocation = location
        Log.d(TAG, "Location updated: ${location.latitude}, ${location.longitude}, accuracy: ${location.accuracy}m")
    }

    // Accelerometer listener
    private val accelerometerListener = object : SensorEventListener {
        override fun onSensorChanged(event: SensorEvent) {
            accelerometerData = event.values.clone()
        }

        override fun onAccuracyChanged(sensor: Sensor, accuracy: Int) {}
    }

    // Gyroscope listener
    private val gyroscopeListener = object : SensorEventListener {
        override fun onSensorChanged(event: SensorEvent) {
            gyroscopeData = event.values.clone()
        }

        override fun onAccuracyChanged(sensor: Sensor, accuracy: Int) {}
    }

    // Magnetometer listener
    private val magnetometerListener = object : SensorEventListener {
        override fun onSensorChanged(event: SensorEvent) {
            magnetometerData = event.values.clone()
        }

        override fun onAccuracyChanged(sensor: Sensor, accuracy: Int) {}
    }

    // Pressure sensor listener
    private val pressureListener = object : SensorEventListener {
        override fun onSensorChanged(event: SensorEvent) {
            pressureData = event.values[0]
        }

        override fun onAccuracyChanged(sensor: Sensor, accuracy: Int) {}
    }

    @ReactMethod
    fun requestLocationPermission(promise: Promise) {
        // Permissions should be requested from JavaScript side using PermissionsAndroid
        // This method just checks if permissions are granted
        val hasPermission = ActivityCompat.checkSelfPermission(
            reactApplicationContext,
            Manifest.permission.ACCESS_FINE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED

        promise.resolve(Arguments.createMap().apply {
            putBoolean("granted", hasPermission)
        })
    }

    @ReactMethod
    fun startLocationUpdates(promise: Promise) {
        try {
            if (ActivityCompat.checkSelfPermission(
                    reactApplicationContext,
                    Manifest.permission.ACCESS_FINE_LOCATION
                ) != PackageManager.PERMISSION_GRANTED
            ) {
                Log.w(TAG, "Location permission not granted")
                NativeLogger.warn(TAG, "Location permission not granted")
                promise.reject("PERMISSION_DENIED", "Location permission not granted")
                return
            }

            Log.d(TAG, "Starting location updates...")
            NativeLogger.info(TAG, "Starting location updates...")

            // Try to get last known location first (instant fallback)
            try {
                val lastGpsLocation = locationManager.getLastKnownLocation(LocationManager.GPS_PROVIDER)
                val lastNetworkLocation = locationManager.getLastKnownLocation(LocationManager.NETWORK_PROVIDER)

                // Use the most recent one
                val lastLocation = when {
                    lastGpsLocation != null && lastNetworkLocation != null -> {
                        if (lastGpsLocation.time > lastNetworkLocation.time) lastGpsLocation else lastNetworkLocation
                    }
                    lastGpsLocation != null -> lastGpsLocation
                    lastNetworkLocation != null -> lastNetworkLocation
                    else -> null
                }

                if (lastLocation != null) {
                    currentLocation = lastLocation
                    val msg = "Got last known location: ${lastLocation.latitude}, ${lastLocation.longitude}, age: ${(System.currentTimeMillis() - lastLocation.time) / 1000}s, accuracy: ${lastLocation.accuracy}m"
                    Log.d(TAG, msg)
                    NativeLogger.info(TAG, msg)
                }
            } catch (e: Exception) {
                Log.w(TAG, "Could not get last known location: ${e.message}")
            }

            // Request updates from both GPS and Network providers for faster fix
            var gpsStarted = false
            var networkStarted = false

            // Try GPS provider (most accurate)
            try {
                if (locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER)) {
                    locationManager.requestLocationUpdates(
                        LocationManager.GPS_PROVIDER,
                        1000, // 1 second
                        0f,   // 0 meters
                        locationListener
                    )
                    gpsStarted = true
                    Log.d(TAG, "GPS location updates started")
                    NativeLogger.info(TAG, "GPS location updates started")
                } else {
                    Log.w(TAG, "GPS provider is disabled")
                    NativeLogger.warn(TAG, "GPS provider is disabled - please enable Location Services")
                }
            } catch (e: Exception) {
                Log.w(TAG, "Failed to start GPS updates: ${e.message}")
            }

            // Try Network provider (faster, less accurate)
            try {
                if (locationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER)) {
                    locationManager.requestLocationUpdates(
                        LocationManager.NETWORK_PROVIDER,
                        1000, // 1 second
                        0f,   // 0 meters
                        locationListener
                    )
                    networkStarted = true
                    Log.d(TAG, "Network location updates started")
                    NativeLogger.info(TAG, "Network location updates started")
                } else {
                    Log.w(TAG, "Network provider is disabled")
                }
            } catch (e: Exception) {
                Log.w(TAG, "Failed to start Network updates: ${e.message}")
            }

            if (!gpsStarted && !networkStarted) {
                val msg = "No location providers available. Please enable GPS in Settings."
                Log.e(TAG, msg)
                NativeLogger.error(TAG, msg)
                promise.reject("NO_PROVIDER", msg)
                return
            }

            val statusMsg = "Location updates started (GPS: $gpsStarted, Network: $networkStarted)"
            Log.d(TAG, statusMsg)
            NativeLogger.info(TAG, statusMsg)

            promise.resolve(Arguments.createMap().apply {
                putBoolean("started", true)
                putBoolean("gpsStarted", gpsStarted)
                putBoolean("networkStarted", networkStarted)
            })
        } catch (e: Exception) {
            Log.e(TAG, "Failed to start location updates", e)
            NativeLogger.error(TAG, "Failed to start location updates: ${e.message}")
            promise.reject("ERROR", "Failed to start location updates: ${e.message}")
        }
    }

    @ReactMethod
    fun stopLocationUpdates(promise: Promise) {
        try {
            locationManager.removeUpdates(locationListener)
            promise.resolve(Arguments.createMap().apply {
                putBoolean("stopped", true)
            })
        } catch (e: Exception) {
            promise.reject("ERROR", "Failed to stop location updates: ${e.message}")
        }
    }

    @ReactMethod
    fun startAccelerometerUpdates(promise: Promise) {
        val accelerometer = sensorManager.getDefaultSensor(Sensor.TYPE_ACCELEROMETER)
        if (accelerometer != null) {
            sensorManager.registerListener(
                accelerometerListener,
                accelerometer,
                SensorManager.SENSOR_DELAY_NORMAL
            )
            promise.resolve(Arguments.createMap().apply {
                putBoolean("started", true)
            })
        } else {
            promise.reject("UNAVAILABLE", "Accelerometer not available")
        }
    }

    @ReactMethod
    fun stopAccelerometerUpdates(promise: Promise) {
        sensorManager.unregisterListener(accelerometerListener)
        promise.resolve(Arguments.createMap().apply {
            putBoolean("stopped", true)
        })
    }

    @ReactMethod
    fun startGyroscopeUpdates(promise: Promise) {
        val gyroscope = sensorManager.getDefaultSensor(Sensor.TYPE_GYROSCOPE)
        if (gyroscope != null) {
            sensorManager.registerListener(
                gyroscopeListener,
                gyroscope,
                SensorManager.SENSOR_DELAY_NORMAL
            )
            promise.resolve(Arguments.createMap().apply {
                putBoolean("started", true)
            })
        } else {
            promise.reject("UNAVAILABLE", "Gyroscope not available")
        }
    }

    @ReactMethod
    fun stopGyroscopeUpdates(promise: Promise) {
        sensorManager.unregisterListener(gyroscopeListener)
        promise.resolve(Arguments.createMap().apply {
            putBoolean("stopped", true)
        })
    }

    @ReactMethod
    fun startMagnetometerUpdates(promise: Promise) {
        val magnetometer = sensorManager.getDefaultSensor(Sensor.TYPE_MAGNETIC_FIELD)
        if (magnetometer != null) {
            sensorManager.registerListener(
                magnetometerListener,
                magnetometer,
                SensorManager.SENSOR_DELAY_NORMAL
            )
            promise.resolve(Arguments.createMap().apply {
                putBoolean("started", true)
            })
        } else {
            promise.reject("UNAVAILABLE", "Magnetometer not available")
        }
    }

    @ReactMethod
    fun stopMagnetometerUpdates(promise: Promise) {
        sensorManager.unregisterListener(magnetometerListener)
        promise.resolve(Arguments.createMap().apply {
            putBoolean("stopped", true)
        })
    }

    @ReactMethod
    fun startAltimeterUpdates(promise: Promise) {
        val pressure = sensorManager.getDefaultSensor(Sensor.TYPE_PRESSURE)
        if (pressure != null) {
            sensorManager.registerListener(
                pressureListener,
                pressure,
                SensorManager.SENSOR_DELAY_NORMAL
            )
            promise.resolve(Arguments.createMap().apply {
                putBoolean("started", true)
            })
        } else {
            promise.reject("UNAVAILABLE", "Pressure sensor not available")
        }
    }

    @ReactMethod
    fun stopAltimeterUpdates(promise: Promise) {
        sensorManager.unregisterListener(pressureListener)
        promise.resolve(Arguments.createMap().apply {
            putBoolean("stopped", true)
        })
    }

    @ReactMethod
    fun getLocationData(promise: Promise) {
        val location = currentLocation
        if (location != null) {
            promise.resolve(Arguments.createMap().apply {
                putDouble("latitude", location.latitude)
                putDouble("longitude", location.longitude)
                putDouble("altitude", location.altitude)
                putDouble("accuracy", location.accuracy.toDouble())
                putDouble("speed", location.speed.toDouble())
                putDouble("heading", location.bearing.toDouble())
                putDouble("timestamp", location.time.toDouble())
            })
        } else {
            promise.resolve(null)
        }
    }

    @ReactMethod
    fun getAccelerometerData(promise: Promise) {
        val data = accelerometerData
        if (data != null && data.size >= 3) {
            promise.resolve(Arguments.createMap().apply {
                putDouble("x", data[0].toDouble())
                putDouble("y", data[1].toDouble())
                putDouble("z", data[2].toDouble())
            })
        } else {
            promise.resolve(null)
        }
    }

    @ReactMethod
    fun getGyroscopeData(promise: Promise) {
        val data = gyroscopeData
        if (data != null && data.size >= 3) {
            promise.resolve(Arguments.createMap().apply {
                putDouble("x", data[0].toDouble())
                putDouble("y", data[1].toDouble())
                putDouble("z", data[2].toDouble())
            })
        } else {
            promise.resolve(null)
        }
    }

    @ReactMethod
    fun getCompassData(promise: Promise) {
        val magnetic = magnetometerData
        if (magnetic != null) {
            // Calculate heading from magnetometer data
            val heading = Math.toDegrees(Math.atan2(magnetic[1].toDouble(), magnetic[0].toDouble()))
            val normalizedHeading = (heading + 360) % 360

            promise.resolve(Arguments.createMap().apply {
                putDouble("magneticHeading", normalizedHeading)
                putDouble("trueHeading", normalizedHeading) // Simplified, no declination correction
                putDouble("accuracy", 0.0)
            })
        } else {
            promise.resolve(null)
        }
    }

    @ReactMethod
    fun getAltimeterData(promise: Promise) {
        val pressure = pressureData
        if (pressure != null) {
            // Convert pressure to altitude using standard atmosphere
            val altitude = SensorManager.getAltitude(SensorManager.PRESSURE_STANDARD_ATMOSPHERE, pressure)

            promise.resolve(Arguments.createMap().apply {
                putDouble("relativeAltitude", altitude.toDouble())
                putDouble("pressure", pressure.toDouble())
            })
        } else {
            promise.resolve(null)
        }
    }

    @ReactMethod
    fun getBatteryData(promise: Promise) {
        val level = batteryManager.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY)
        val isCharging = batteryManager.isCharging

        promise.resolve(Arguments.createMap().apply {
            putDouble("level", level / 100.0)
            putBoolean("isCharging", isCharging)
        })
    }

    @ReactMethod
    fun getDeviceInfo(promise: Promise) {
        promise.resolve(Arguments.createMap().apply {
            putString("identifier", Build.ID)
            putString("model", Build.MODEL)
            putString("systemName", "Android")
            putString("systemVersion", Build.VERSION.RELEASE)
            putString("name", Build.MODEL) // Device name same as model on Android
        })
    }

    @ReactMethod
    fun getAllSensorData(promise: Promise) {
        val result = Arguments.createMap()

        // Location
        if (currentLocation != null) {
            val location = currentLocation!!
            result.putMap("location", Arguments.createMap().apply {
                putDouble("latitude", location.latitude)
                putDouble("longitude", location.longitude)
                putDouble("altitude", location.altitude)
                putDouble("accuracy", location.accuracy.toDouble())
                putDouble("speed", location.speed.toDouble())
                putDouble("heading", location.bearing.toDouble())
                putDouble("timestamp", location.time.toDouble())
            })
            val age = (System.currentTimeMillis() - location.time) / 1000
            Log.d(TAG, "getAllSensorData: Location available - ${location.latitude}, ${location.longitude}, accuracy: ${location.accuracy}m, age: ${age}s")
        } else {
            Log.d(TAG, "getAllSensorData: No location data available")
            NativeLogger.warn(TAG, "No location data available - check if GPS is enabled")
        }

        // Accelerometer
        accelerometerData?.let { data ->
            if (data.size >= 3) {
                result.putMap("accelerometer", Arguments.createMap().apply {
                    putDouble("x", data[0].toDouble())
                    putDouble("y", data[1].toDouble())
                    putDouble("z", data[2].toDouble())
                })
            }
        }

        // Gyroscope
        gyroscopeData?.let { data ->
            if (data.size >= 3) {
                result.putMap("gyroscope", Arguments.createMap().apply {
                    putDouble("x", data[0].toDouble())
                    putDouble("y", data[1].toDouble())
                    putDouble("z", data[2].toDouble())
                })
            }
        }

        // Compass
        if (magnetometerData != null) {
            val magnetic = magnetometerData!!
            val heading = Math.toDegrees(Math.atan2(magnetic[1].toDouble(), magnetic[0].toDouble()))
            val normalizedHeading = (heading + 360) % 360

            result.putMap("compass", Arguments.createMap().apply {
                putDouble("magneticHeading", normalizedHeading)
                putDouble("trueHeading", normalizedHeading)
            })
            Log.d(TAG, "getAllSensorData: Compass heading ${normalizedHeading}°")
        } else {
            Log.d(TAG, "getAllSensorData: No compass/magnetometer data available")
        }

        // Altimeter
        pressureData?.let { pressure ->
            val altitude = SensorManager.getAltitude(SensorManager.PRESSURE_STANDARD_ATMOSPHERE, pressure)
            result.putMap("altimeter", Arguments.createMap().apply {
                putDouble("relativeAltitude", altitude.toDouble())
                putDouble("pressure", pressure.toDouble())
            })
        }

        // Battery
        val level = batteryManager.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY)
        val isCharging = batteryManager.isCharging
        result.putMap("battery", Arguments.createMap().apply {
            putDouble("level", level / 100.0)
            putBoolean("isCharging", isCharging)
        })

        // Device info
        result.putMap("device", Arguments.createMap().apply {
            putString("identifier", Build.ID)
            putString("model", Build.MODEL)
            putString("systemName", "Android")
            putString("systemVersion", Build.VERSION.RELEASE)
            putString("name", Build.MODEL)
        })

        // Timestamp
        result.putDouble("timestamp", System.currentTimeMillis().toDouble())

        promise.resolve(result)
    }
}

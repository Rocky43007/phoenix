# Phoenix: Disaster Relief Emergency Beacon System

## Mission

Phoenix is a disaster relief application designed to help locate and rescue people in emergency situations where traditional communication infrastructure may be compromised or unavailable.

## Core Concept

The system consists of two React Native applications that work together to create an ad-hoc emergency beacon network:

### Emitter App
The **emitter** application runs on phones carried by people who need to be located. It continuously collects and broadcasts sensor data including:

- **GPS/Location Data**: Latitude, longitude, altitude, accuracy, speed
- **Accelerometer Data**: Motion detection, fall detection, activity state
- **Battery Status**: Current battery level and charging state
- **Device Information**: Model, system version, device name

This data is transmitted via Bluetooth Low Energy (BLE) and WiFi to nearby receiver devices, creating a mesh network of location signals.

### Receiver App
The **receiver** application runs on phones carried by first responders or search and rescue teams. It features:

- **FindMy-Style Interface**: Apple FindMy-inspired hot/cold proximity detection
- **Directional Navigation**: Arrows and visual cues pointing toward emitter devices
- **Real-time Tracking**: Live location updates from multiple emitters
- **Distance Feedback**: Visual and audio feedback indicating proximity to targets

## Use Cases

- **Natural Disasters**: Earthquakes, floods, hurricanes where cellular towers are down
- **Remote Area Emergencies**: Mountain rescue, wilderness search and rescue
- **Building Collapse**: Locating survivors in rubble when GPS signals are weak
- **Mass Casualty Events**: Coordinating rescue efforts across large areas

## Technical Approach

- **Bluetooth Low Energy**: Primary transmission method for short-range communication
- **WiFi Direct**: Fallback for longer-range communication when available
- **Offline-First**: Designed to work without internet connectivity
- **Battery Efficient**: Optimized for extended operation in emergency scenarios
- **Cross-Platform**: React Native for iOS and Android support

## Privacy & Ethics

This system is designed for **consensual emergency use only**. Users must:
- Explicitly enable emitter mode when requesting help
- Understand what sensor data is being collected and transmitted
- Have the ability to disable transmission at any time

The technology is built for disaster relief and rescue operations, not for surveillance or tracking without consent.

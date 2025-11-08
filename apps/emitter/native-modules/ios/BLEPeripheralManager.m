#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(BLEPeripheralManager, NSObject)

// Initialize the peripheral manager
RCT_EXTERN_METHOD(initializePeripheral:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

// Start BLE advertising with beacon data
RCT_EXTERN_METHOD(startAdvertising:(NSString *)beaconData
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

// Stop BLE advertising
RCT_EXTERN_METHOD(stopAdvertising:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

// Check if currently advertising
RCT_EXTERN_METHOD(isCurrentlyAdvertising:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

// Get Bluetooth state
RCT_EXTERN_METHOD(getBluetoothState:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

@end

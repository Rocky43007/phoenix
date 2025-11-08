#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(HelloWorldModule, NSObject)

RCT_EXTERN_METHOD(getHelloWorld:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(getDeviceInfo:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

@end

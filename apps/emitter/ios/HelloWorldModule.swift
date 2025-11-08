import Foundation
import React

@objc(HelloWorldModule)
class HelloWorldModule: NSObject {

  @objc
  static func requiresMainQueueSetup() -> Bool {
    return false
  }

  @objc
  func getHelloWorld(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    // Simulate some async work
    DispatchQueue.global(qos: .background).async {
      // You can do any native work here (network calls, device APIs, etc.)
      let message = "Hello World from Swift Native Module!"

      // Simulate a small delay to show async behavior
      Thread.sleep(forTimeInterval: 0.5)

      // Resolve the promise on the main queue
      DispatchQueue.main.async {
        resolve(message)
      }
    }
  }

  @objc
  func getDeviceInfo(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    let deviceInfo: [String: Any] = [
      "model": UIDevice.current.model,
      "systemName": UIDevice.current.systemName,
      "systemVersion": UIDevice.current.systemVersion,
      "name": UIDevice.current.name
    ]
    resolve(deviceInfo)
  }
}

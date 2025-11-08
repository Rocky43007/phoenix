import { NativeModules } from 'react-native';

interface DeviceInfo {
  model: string;
  systemName: string;
  systemVersion: string;
  name: string;
}

interface HelloWorldModuleInterface {
  getHelloWorld(): Promise<string>;
  getDeviceInfo(): Promise<DeviceInfo>;
}

const { HelloWorldModule } = NativeModules;

if (!HelloWorldModule) {
  throw new Error(
    'HelloWorldModule native module is not available. ' +
    'Make sure you have rebuilt the native app after adding the module.'
  );
}

export default HelloWorldModule as HelloWorldModuleInterface;

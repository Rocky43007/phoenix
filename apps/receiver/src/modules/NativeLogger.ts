import { NativeModules, NativeEventEmitter } from 'react-native';

const { NativeLogger: NativeLoggerModule } = NativeModules;

interface NativeLogEvent {
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  source: 'iOS' | 'Android';
  tag?: string;
  file?: string;
  line?: number;
  timestamp: number;
}

class NativeLoggerBridge {
  private eventEmitter: NativeEventEmitter | null = null;
  private isListening: boolean = false;

  constructor() {
    // Only create event emitter if native module is available
    if (NativeLoggerModule) {
      this.eventEmitter = new NativeEventEmitter(NativeLoggerModule);
    } else {
      console.warn('NativeLogger module not available - native logs will not be forwarded');
    }
  }

  /**
   * Start forwarding native logs to Metro console
   */
  startLogging(): void {
    if (!this.eventEmitter) {
      return; // Module not available
    }

    if (this.isListening) {
      return;
    }

    this.eventEmitter.addListener('NativeLog', (event: NativeLogEvent) => {
      this.forwardToConsole(event);
    });

    this.isListening = true;
    console.log('📱 Native log forwarding enabled');
  }

  /**
   * Forward native log to appropriate console method
   */
  private forwardToConsole(event: NativeLogEvent): void {
    const prefix = `[${event.source}]`;
    const location = event.file && event.line
      ? ` ${event.file}:${event.line}`
      : event.tag
      ? ` ${event.tag}`
      : '';

    const message = `${prefix}${location} ${event.message}`;

    switch (event.level) {
      case 'debug':
        console.log(message);
        break;
      case 'info':
        console.info(message);
        break;
      case 'warn':
        console.warn(message);
        break;
      case 'error':
        console.error(message);
        break;
    }
  }

  /**
   * Stop forwarding native logs
   */
  stopLogging(): void {
    if (!this.eventEmitter || !this.isListening) {
      return;
    }

    this.eventEmitter.removeAllListeners('NativeLog');
    this.isListening = false;
    console.log('📱 Native log forwarding disabled');
  }
}

export default new NativeLoggerBridge();

import { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Container, Text, Button } from '@phoenix/ui';
import { APP_NAME } from '@phoenix/utils';
import HelloWorldModule from './src/modules/HelloWorldModule';

export default function App() {
  const [message, setMessage] = useState<string>('');
  const [deviceInfo, setDeviceInfo] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  const handleGetHelloWorld = async () => {
    try {
      setLoading(true);
      const result = await HelloWorldModule.getHelloWorld();
      setMessage(result);
      console.log('Native module returned:', result);
    } catch (error) {
      console.error('Error calling native module:', error);
      setMessage('Error: ' + error);
    } finally {
      setLoading(false);
    }
  };

  const handleGetDeviceInfo = async () => {
    try {
      setLoading(true);
      const info = await HelloWorldModule.getDeviceInfo();
      const infoText = `${info.name}\n${info.model}\n${info.systemName} ${info.systemVersion}`;
      setDeviceInfo(infoText);
      console.log('Device info:', info);
    } catch (error) {
      console.error('Error getting device info:', error);
      setDeviceInfo('Error: ' + error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container centered>
      <Text variant="title">{APP_NAME} Emitter</Text>
      <Text variant="body" style={{ marginVertical: 20 }}>
        Native Module Demo
      </Text>

      <Button
        title={loading ? "Loading..." : "Get Hello World"}
        onPress={handleGetHelloWorld}
        disabled={loading}
      />

      {message ? (
        <Text variant="body" style={{ marginTop: 20, color: '#007AFF' }}>
          {message}
        </Text>
      ) : null}

      <Button
        title="Get Device Info"
        onPress={handleGetDeviceInfo}
        disabled={loading}
        variant="secondary"
        style={{ marginTop: 20 }}
      />

      {deviceInfo ? (
        <Text variant="caption" style={{ marginTop: 20, textAlign: 'center' }}>
          {deviceInfo}
        </Text>
      ) : null}

      <StatusBar style="auto" />
    </Container>
  );
}

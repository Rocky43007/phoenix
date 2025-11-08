import { StatusBar } from 'expo-status-bar';
import { Container, Text, Button } from '@phoenix/ui';
import { APP_NAME } from '@phoenix/utils';

export default function App() {
  const handlePress = () => {
    console.log('Receiver ready to receive messages via BLE');
  };

  return (
    <Container centered>
      <Text variant="title">{APP_NAME} Receiver</Text>
      <Text variant="body" style={{ marginVertical: 20 }}>
        Ready to receive messages via Bluetooth
      </Text>
      <Button title="Start Listening" onPress={handlePress} />
      <StatusBar style="auto" />
    </Container>
  );
}

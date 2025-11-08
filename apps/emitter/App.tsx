import { StatusBar } from 'expo-status-bar';
import { Container, Text, Button } from '@phoenix/ui';
import { APP_NAME } from '@phoenix/utils';

export default function App() {
  const handlePress = () => {
    console.log('Emitter ready to send messages via BLE');
  };

  return (
    <Container centered>
      <Text variant="title">{APP_NAME} Emitter</Text>
      <Text variant="body" style={{ marginVertical: 20 }}>
        Ready to emit messages via Bluetooth
      </Text>
      <Button title="Send Message" onPress={handlePress} variant="secondary" />
      <StatusBar style="auto" />
    </Container>
  );
}

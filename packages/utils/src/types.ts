export interface Message {
  id: string;
  type: 'emit' | 'receive';
  payload: unknown;
  timestamp: number;
}

export interface AppConfig {
  apiUrl?: string;
  timeout?: number;
  debug?: boolean;
}

export type MessageHandler = (message: Message) => void;

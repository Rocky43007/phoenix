import { Message } from './types';

export const generateId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

export const createMessage = (
  type: 'emit' | 'receive',
  payload: unknown
): Message => {
  return {
    id: generateId(),
    type,
    payload,
    timestamp: Date.now(),
  };
};

export const formatTimestamp = (timestamp: number): string => {
  return new Date(timestamp).toLocaleTimeString();
};

export const delay = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

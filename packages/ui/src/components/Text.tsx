import React from 'react';
import { Text as RNText, TextProps as RNTextProps, StyleSheet } from 'react-native';

export interface TextProps extends RNTextProps {
  variant?: 'title' | 'body' | 'caption';
}

export const Text: React.FC<TextProps> = ({
  variant = 'body',
  style,
  ...props
}) => {
  return (
    <RNText
      style={[
        styles.base,
        variant === 'title' && styles.title,
        variant === 'body' && styles.body,
        variant === 'caption' && styles.caption,
        style,
      ]}
      {...props}
    />
  );
};

const styles = StyleSheet.create({
  base: {
    color: '#000000',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  body: {
    fontSize: 16,
  },
  caption: {
    fontSize: 12,
    color: '#666666',
  },
});

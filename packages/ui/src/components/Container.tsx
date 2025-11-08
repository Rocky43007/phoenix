import React from 'react';
import { View, ViewProps, StyleSheet } from 'react-native';

export interface ContainerProps extends ViewProps {
  centered?: boolean;
}

export const Container: React.FC<ContainerProps> = ({
  centered = false,
  style,
  ...props
}) => {
  return (
    <View
      style={[
        styles.container,
        centered && styles.centered,
        style,
      ]}
      {...props}
    />
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

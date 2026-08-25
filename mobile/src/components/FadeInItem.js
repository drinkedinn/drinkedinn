// src/components/FadeInItem.js — staggered slide+fade reveal for list items.
import React, { useEffect, useRef } from 'react';
import { Animated } from 'react-native';

export default function FadeInItem({ index = 0, children }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, {
      toValue: 1,
      duration: 420,
      delay: Math.min(index, 8) * 55,
      useNativeDriver: true,
    }).start();
  }, []);
  return (
    <Animated.View
      style={{
        opacity: v,
        transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }],
      }}
    >
      {children}
    </Animated.View>
  );
}

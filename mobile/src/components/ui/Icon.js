// src/components/ui/Icon.js
// Single icon entry point so the whole app draws from one consistent set
// (Ionicons outline family) instead of scattering emoji through the UI.

import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeContext';

export default function Icon({ name, size = 22, color, style }) {
  const { t } = useTheme();
  return <Ionicons name={name} size={size} color={color || t.text} style={style} />;
}

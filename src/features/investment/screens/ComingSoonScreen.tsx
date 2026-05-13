import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface ComingSoonScreenProps {
  title: string;
  subtitle: string;
  icon: string;
  accentColor?: string;
}

export default function ComingSoonScreen({
  title,
  subtitle,
  icon,
  accentColor = '#8B5CF6',
}: ComingSoonScreenProps) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: '#0B0B0F',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 40,
        paddingBottom: 80,
      }}
    >
      {/* Icon ring */}
      <View
        style={{
          width: 96,
          height: 96,
          borderRadius: 48,
          backgroundColor: `${accentColor}15`,
          borderWidth: 2,
          borderColor: `${accentColor}40`,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 28,
        }}
      >
        <Ionicons name={icon as any} size={44} color={accentColor} />
      </View>

      {/* Title */}
      <Text
        style={{
          fontSize: 26,
          fontWeight: '700',
          color: '#FFFFFF',
          marginBottom: 12,
          textAlign: 'center',
        }}
      >
        {title}
      </Text>

      {/* Subtitle */}
      <Text
        style={{
          fontSize: 14,
          color: '#888888',
          textAlign: 'center',
          lineHeight: 22,
          marginBottom: 32,
        }}
      >
        {subtitle}
      </Text>

      {/* Coming soon badge */}
      <View
        style={{
          paddingHorizontal: 20,
          paddingVertical: 10,
          borderRadius: 24,
          backgroundColor: `${accentColor}20`,
          borderWidth: 1,
          borderColor: `${accentColor}60`,
        }}
      >
        <Text
          style={{
            color: accentColor,
            fontSize: 13,
            fontWeight: '600',
            letterSpacing: 1,
            textTransform: 'uppercase',
          }}
        >
          Coming Soon
        </Text>
      </View>
    </View>
  );
}

import React from 'react';
import { Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRoute } from '@react-navigation/native';
import AppScreen from '../components/AppScreen';
import GlassHeader from '../components/GlassHeader';

export default function FeaturePlaceholderScreen() {
  const route = useRoute();
  const title = route.params?.title || 'Coming soon';
  const message = route.params?.message || 'This module is available on the web app for full create/edit workflows.';
  const icon = route.params?.icon || 'tools';

  return (
    <AppScreen>
      <GlassHeader title={title} />
      <View style={{ alignItems: 'center', marginTop: 48, paddingHorizontal: 24 }}>
        <MaterialCommunityIcons name={icon} size={56} color="#6366F1" />
        <Text style={{ fontSize: 18, fontWeight: '700', color: '#1E293B', marginTop: 16, textAlign: 'center' }}>
          {title}
        </Text>
        <Text style={{ fontSize: 14, color: '#64748B', marginTop: 12, textAlign: 'center', lineHeight: 22 }}>
          {message}
        </Text>
      </View>
    </AppScreen>
  );
}

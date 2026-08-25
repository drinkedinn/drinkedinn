// src/navigation/RootNavigator.js
import React, { useState, useEffect, useCallback } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../theme/ThemeContext';
import api from '../api';

import AuthScreen from '../screens/AuthScreen';
import LockScreen from '../screens/LockScreen';
import FeedScreen from '../screens/FeedScreen';
import ExploreScreen from '../screens/ExploreScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import ProfileScreen from '../screens/ProfileScreen';
import CreatePostScreen from '../screens/CreatePostScreen';
import PostDetailScreen from '../screens/PostDetailScreen';

import AccountScreen from '../screens/account/AccountScreen';
import EditProfileScreen from '../screens/account/EditProfileScreen';
import SecurityScreen from '../screens/account/SecurityScreen';
import AppearanceScreen from '../screens/account/AppearanceScreen';
import NotificationSettingsScreen from '../screens/account/NotificationSettingsScreen';
import PrivacyScreen from '../screens/account/PrivacyScreen';
import AgeVerificationScreen from '../screens/account/AgeVerificationScreen';
import { HelpScreen, ResponsibleScreen, LegalScreen } from '../screens/account/InfoScreens';

import TabBar from './TabBar';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function Tabs() {
  const [unread, setUnread] = useState(0);

  const poll = useCallback(async () => {
    try {
      const res = await api.get('/notifications/count');
      setUnread(res.data?.count || 0);
    } catch {}
  }, []);

  useEffect(() => {
    poll();
    const id = setInterval(poll, 60000);
    return () => clearInterval(id);
  }, [poll]);

  return (
    <Tab.Navigator
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <TabBar {...props} unreadCount={unread} />}
    >
      <Tab.Screen name="Home" component={FeedScreen} />
      <Tab.Screen name="Discover" component={ExploreScreen} />
      <Tab.Screen name="Activity" component={NotificationsScreen} />
      <Tab.Screen name="Account" component={AccountScreen} />
    </Tab.Navigator>
  );
}

export default function RootNavigator() {
  const { user, booting, locked } = useAuth();
  const { t } = useTheme();

  if (booting) {
    return (
      <View style={{ flex: 1, backgroundColor: t.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={t.accent} size="large" />
      </View>
    );
  }

  if (user && locked) return <LockScreen />;

  return (
    <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.bg } }}>
      {!user ? (
        <Stack.Screen name="Auth" component={AuthScreen} />
      ) : (
        <>
          <Stack.Screen name="Tabs" component={Tabs} />
          <Stack.Screen name="PostDetail" component={PostDetailScreen} />
          <Stack.Screen name="User" component={ProfileScreen} />
          <Stack.Screen name="Compose" component={CreatePostScreen} options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />

          {/* Account stack */}
          <Stack.Screen name="EditProfile" component={EditProfileScreen} />
          <Stack.Screen name="Security" component={SecurityScreen} />
          <Stack.Screen name="Appearance" component={AppearanceScreen} />
          <Stack.Screen name="NotificationSettings" component={NotificationSettingsScreen} />
          <Stack.Screen name="Privacy" component={PrivacyScreen} />
          <Stack.Screen name="AgeVerification" component={AgeVerificationScreen} />
          <Stack.Screen name="Help" component={HelpScreen} />
          <Stack.Screen name="Responsible" component={ResponsibleScreen} />
          <Stack.Screen name="Legal" component={LegalScreen} />
        </>
      )}
    </Stack.Navigator>
  );
}

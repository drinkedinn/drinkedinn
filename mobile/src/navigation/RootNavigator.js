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


// ── feature modules built by the mobile-complete workflow ───────────────────
import ConversationsScreen from '../screens/messages/ConversationsScreen';
import ThreadScreen from '../screens/messages/ThreadScreen';
import StoryViewerScreen from '../screens/stories/StoryViewerScreen';
import CreateStoryScreen from '../screens/stories/CreateStoryScreen';
import TasteScreen from '../screens/taste/TasteScreen';
import AddRatingScreen from '../screens/taste/AddRatingScreen';
import AddBottleScreen from '../screens/taste/AddBottleScreen';
import GroupsScreen from '../screens/groups/GroupsScreen';
import GroupDetailScreen from '../screens/groups/GroupDetailScreen';
import CreateGroupScreen from '../screens/groups/CreateGroupScreen';
import EventsScreen from '../screens/events/EventsScreen';
import EventDetailScreen from '../screens/events/EventDetailScreen';
import CreateEventScreen from '../screens/events/CreateEventScreen';
import ChallengesScreen from '../screens/challenges/ChallengesScreen';
import ChallengeLeaderboardScreen from '../screens/challenges/LeaderboardScreen';
import SommelierScreen from '../screens/sommelier/SommelierScreen';
import InviteScreen from '../screens/referrals/InviteScreen';
import OnboardingScreen from '../screens/onboarding/OnboardingScreen';
import TripsScreen from '../screens/feedmodes/TripsScreen';
import CheeredScreen from '../screens/feedmodes/CheeredScreen';
import HashtagScreen from '../screens/feedmodes/HashtagScreen';

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
      ) : !user.onboarded ? (
        // First-run gate. Once /onboarding/complete flips the flag and refresh()
        // repulls the user, this branch stops matching and Tabs mounts.
        <Stack.Screen name="Onboarding" component={OnboardingScreen} />
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

          {/* Feature modules — push screens */}
          <Stack.Screen name="Conversations" component={ConversationsScreen} />
          <Stack.Screen name="Thread" component={ThreadScreen} />
          <Stack.Screen name="StoryViewer" component={StoryViewerScreen} options={{ animation: 'fade', contentStyle: { backgroundColor: '#000' } }} />
          <Stack.Screen name="Taste" component={TasteScreen} />
          <Stack.Screen name="Groups" component={GroupsScreen} />
          <Stack.Screen name="GroupDetail" component={GroupDetailScreen} />
          <Stack.Screen name="Events" component={EventsScreen} />
          <Stack.Screen name="EventDetail" component={EventDetailScreen} />
          <Stack.Screen name="Challenges" component={ChallengesScreen} />
          <Stack.Screen name="ChallengeLeaderboard" component={ChallengeLeaderboardScreen} />
          <Stack.Screen name="AskInnkeeper" component={SommelierScreen} />
          <Stack.Screen name="Invite" component={InviteScreen} />
          <Stack.Screen name="Trips" component={TripsScreen} />
          <Stack.Screen name="Cheered" component={CheeredScreen} />
          <Stack.Screen name="Hashtag" component={HashtagScreen} />

          {/* Feature modules — modals */}
          <Stack.Screen name="CreateStory" component={CreateStoryScreen} options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
          <Stack.Screen name="AddRating" component={AddRatingScreen} options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
          <Stack.Screen name="AddBottle" component={AddBottleScreen} options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
          <Stack.Screen name="CreateGroup" component={CreateGroupScreen} options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
          <Stack.Screen name="CreateEvent" component={CreateEventScreen} options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        </>
      )}
    </Stack.Navigator>
  );
}

// src/components/onboarding-v2/StepBodies.js
// The scrollable body of each onboarding step.
//
// Every one of these is presentational: it takes values and callbacks and owns
// no state, no requests and no navigation. All of that lives in
// OnboardingV2Screen, which is the only place the flow can be reasoned about as
// a whole. Splitting it this way keeps the screen readable and makes each step
// something you can look at on its own.

import React from 'react';
import { View, Text, ScrollView, RefreshControl } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { type } from '../../theme/tokens';
import { EmptyState } from '../ui';

import WelcomeHero from './WelcomeHero';
import DobField from './DobField';
import CountryPicker from './CountryPicker';
import ConsentBlock from './ConsentBlock';
import InterestGrid from './InterestGrid';
import PersonRow, { PersonRowSkeleton } from './PersonRow';
import { Heading, Note, Benefit, Hairline, bits } from './Bits';

/* ── 1 · Welcome ──────────────────────────────────────────────────────────── */

export function WelcomeStep() {
  const { t } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ flex: 1 }} />
      <WelcomeHero />
      <View style={{ paddingHorizontal: 28, marginTop: 30 }}>
        <Text style={[type.display, { color: t.text, textAlign: 'center' }]}>DrinkedInn</Text>
        <Text style={[type.h2, { color: t.accentText, textAlign: 'center', marginTop: 8 }]}>
          Stories start here.
        </Text>
        <Text style={[type.body, { color: t.textSecondary, textAlign: 'center', marginTop: 12, lineHeight: 22 }]}>
          Your people. Your places. Your stories.
        </Text>
      </View>
      <View style={{ flex: 1.25 }} />
    </View>
  );
}

/* ── 2 · Age and country ──────────────────────────────────────────────────── */

export function AgeStep({ dob, onDobChange, dobError, countryCode, onCountryChange, complete }) {
  return (
    <ScrollView contentContainerStyle={bits.body} keyboardShouldPersistTaps="handled">
      <Heading
        title="A little about you"
        body="DrinkedInn is an 18+ community. Your birthday stays private — we use it to keep the room the right age, and your country to show the right local rules."
      />
      <View style={{ paddingHorizontal: 20, gap: 20 }}>
        <DobField value={dob} onChange={onDobChange} error={dobError} />
        <CountryPicker value={countryCode} onChange={onCountryChange} />
      </View>
      {complete && (
        <Note icon="checkmark-circle-outline" tone="success">
          You're all set — welcome in.
        </Note>
      )}
    </ScrollView>
  );
}

/* ── 3 · Terms and Community Guidelines ───────────────────────────────────── */

export function ConsentStep({ accepted, onToggle, onPolicyOpened }) {
  return (
    <ScrollView contentContainerStyle={bits.body}>
      <Heading
        title="How we keep it good in here"
        body="Three short documents, and one box to tick. Please read them — they cover what belongs here, and how we handle anything that doesn't."
      />
      <View style={{ paddingHorizontal: 16 }}>
        <ConsentBlock accepted={accepted} onToggle={onToggle} onOpened={onPolicyOpened} />
      </View>
      <Note icon="lock-closed-outline">
        Report and block are on every profile, story and message. We review everything
        that gets reported.
      </Note>
    </ScrollView>
  );
}

/* ── 4 · Interests ────────────────────────────────────────────────────────── */

export function InterestsStep({ options, selected, onToggle, minimum }) {
  return (
    <ScrollView contentContainerStyle={bits.body}>
      <Heading
        title="What are you into?"
        body={`Pick at least ${minimum}. This shapes the people, places and stories you'll see first — and you can change it any time.`}
      />
      <InterestGrid options={options} value={selected} onToggle={onToggle} />
    </ScrollView>
  );
}

/* ── 5 · People ───────────────────────────────────────────────────────────── */

export function PeopleStep({
  suggestions, failed, followed, busyIds, refreshing, onRefresh, onRetry, onToggleFollow, onOpenMenu,
}) {
  const { t } = useTheme();
  const loading = suggestions === null;
  const list = Array.isArray(suggestions) ? suggestions : [];

  return (
    <ScrollView
      contentContainerStyle={bits.body}
      refreshControl={
        <RefreshControl
          refreshing={!!refreshing}
          onRefresh={onRefresh}
          tintColor={t.accent}
          colors={[t.accent]}
          progressBackgroundColor={t.surface}
        />
      }
    >
      <Heading
        title="Find your people"
        body="A few regulars worth following. Pull down for a fresh set, or skip — Discover is always there."
      />

      {loading ? (
        [0, 1, 2, 3, 4].map((i) => <PersonRowSkeleton key={i} />)
      ) : list.length === 0 ? (
        <EmptyState
          icon={failed ? 'cloud-offline-outline' : 'people-outline'}
          title={failed ? "Couldn't reach the bar" : 'Quiet in here'}
          body={
            failed
              ? "We couldn't load suggestions just now. Give it another try."
              : "No suggestions yet. Skip ahead — you'll find people in Discover."
          }
          actionLabel={failed ? 'Try again' : undefined}
          onAction={failed ? onRetry : undefined}
        />
      ) : (
        list.map((person) => (
          <PersonRow
            key={person.id}
            person={person}
            following={!!followed?.[person.id]}
            busy={!!busyIds?.[person.id]}
            onToggleFollow={onToggleFollow}
            onOpenMenu={onOpenMenu}
          />
        ))
      )}
    </ScrollView>
  );
}

/* ── 6 · Notifications, then finish ───────────────────────────────────────── */

export function FinishStep({ pushStatus }) {
  const { t } = useTheme();
  return (
    <ScrollView contentContainerStyle={bits.body}>
      <Heading
        title="One last thing"
        body="Want a nudge when someone replies to you, or cheers a story you shared? Nothing else — no marketing, no noise."
      />
      <View style={[bits.card, { backgroundColor: t.surface, borderColor: t.border }]}>
        <Benefit
          icon="chatbubble-ellipses-outline"
          title="Replies and mentions"
          body="Hear it when someone joins your conversation."
        />
        <Hairline />
        <Benefit
          icon="people-outline"
          title="New followers"
          body="Know when someone starts following along."
        />
        <Hairline />
        <Benefit
          icon="calendar-outline"
          title="Plans you said yes to"
          body="A quiet reminder before an event starts."
        />
      </View>

      {pushStatus === 'denied' && (
        <Note icon="information-circle-outline" tone="danger">
          Notifications are off in your device settings. You can turn them on later from
          Account → Notifications.
        </Note>
      )}
      {pushStatus === 'granted' && (
        <Note icon="checkmark-circle-outline" tone="success">
          You're set. We'll only reach out when it matters.
        </Note>
      )}
    </ScrollView>
  );
}

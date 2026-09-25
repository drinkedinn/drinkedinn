// src/screens/onboarding/OnboardingScreen.js
// First-run flow. Shown by the navigator when `user && !user.onboarded`.
//
// Four steps, each animated in with StepTransition:
//   1  Welcome        — brand promise and a Get started button
//   2  Your thing     — multi-select chip grid (zero-proof leads)
//   3  Find people    — GET /onboarding/suggestions, per-row follow toggle
//   4  Notifications  — enablePush() (opt-in) then Finish
//
// Progress lives at the top of the screen. Steps 1–3 have a Skip in the header
// that advances the flow; step 4 must resolve through Finish (either via
// "Turn on notifications" or "Not right now"), because the navigator is gated
// on user.onboarded and there is nowhere else to go.
//
// Completion is the same operation regardless of the choices made along the
// way: PUT /users/me to persist name (required by the server) + drinks, then
// POST /onboarding/complete to flip the flag, then refresh() so the navigator
// re-renders and swaps this stack out. If any single request fails we surface
// err.safeMessage and stay put — the user can retry from the same step.

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, Animated, BackHandler } from 'react-native';
import api from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../theme/ThemeContext';
import { radius, type } from '../../theme/tokens';
import { Screen, Button, Icon, useToast } from '../../components/ui';
import { enablePush, getPermissionStatus } from '../../lib/pushNotifications';
import track from '../../lib/track';
import ProgressDots from '../../components/onboarding/ProgressDots';
import StepTransition from '../../components/onboarding/StepTransition';
import WelcomeArt from '../../components/onboarding/WelcomeArt';
import TasteChipGrid from '../../components/onboarding/TasteChipGrid';
import SuggestionRow from '../../components/onboarding/SuggestionRow';
import SuggestionSkeleton from '../../components/onboarding/SuggestionSkeleton';
import TASTE_OPTIONS from './tasteOptions';

const TOTAL = 4;

// Parse the server's `drinks` field, which arrives as either a JSON string or
// an already-parsed object. Everything downstream expects an object.
function parseDrinks(raw) {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try { return JSON.parse(raw); } catch { return {}; }
}

export default function OnboardingScreen() {
  const { t } = useTheme();
  const { user, refresh } = useAuth();
  const toast = useToast();

  const [step, setStep] = useState(1);
  const [tastes, setTastes] = useState(() => {
    const d = parseDrinks(user?.drinks);
    return Array.isArray(d?.tastes) ? d.tastes.filter(Boolean) : [];
  });

  const [suggestions, setSuggestions] = useState(null); // null = loading
  const [followed, setFollowed] = useState({}); // { [id]: boolean }
  const [suggestErr, setSuggestErr] = useState(false);

  const [pushStatus, setPushStatus] = useState('undetermined');
  const [pushing, setPushing] = useState(false);
  const [finishing, setFinishing] = useState(false);

  useEffect(() => { track('onboarding_view', { step: 1 }); }, []);

  // Android hardware back — don't let it drop the user into a half-onboarded
  // state. Walk backward through steps, and swallow the press at step 1.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (step > 1) { setStep((s) => s - 1); return true; }
      return true;
    });
    return () => sub.remove();
  }, [step]);

  const goNext = useCallback(() => {
    setStep((s) => {
      const next = Math.min(TOTAL, s + 1);
      track('onboarding_step_next', { from: s, to: next });
      return next;
    });
  }, []);

  const goSkip = useCallback(() => {
    setStep((s) => {
      const next = Math.min(TOTAL, s + 1);
      track('onboarding_step_skip', { from: s, to: next });
      return next;
    });
  }, []);

  // Prefetch suggestions the moment the user moves off Welcome — it makes
  // step 3 feel instant. Only fetch once; a manual retry is available if it
  // failed the first time.
  const loadSuggestions = useCallback(async () => {
    try {
      const res = await api.get('/onboarding/suggestions');
      const list = Array.isArray(res?.data?.suggestions) ? res.data.suggestions : [];
      const mine = user?.id;
      setSuggestions(list.filter((p) => p && p.id !== mine));
      setSuggestErr(false);
    } catch (e) {
      setSuggestions([]);
      setSuggestErr(true);
      // Silent on prefetch; the retry button on step 3 owns any user-visible
      // error surface so we don't toast twice.
    }
  }, [user?.id]);

  useEffect(() => {
    if (step >= 2 && suggestions === null) loadSuggestions();
  }, [step, suggestions, loadSuggestions]);

  // Check the OS-level push status the moment we land on step 4 so we can
  // reflect "already granted" without prompting a second time.
  useEffect(() => {
    if (step !== TOTAL) return;
    (async () => setPushStatus(await getPermissionStatus()))();
  }, [step]);

  const toggleTaste = useCallback((key) => {
    setTastes((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }, []);

  const toggleFollow = useCallback((id, next) => {
    setFollowed((f) => ({ ...f, [id]: next }));
  }, []);

  // Save the taste selection to the profile. Called on Next from step 2 (or
  // implicitly at Finish if step 2 was skipped, so nothing is lost).
  const persistTastes = useCallback(async () => {
    // Server requires `name` on PUT /users/me. Reuse whatever the account
    // already has — an empty user object would fail that guard.
    if (!user?.name) return;
    const existing = parseDrinks(user?.drinks);
    const nextDrinks = { ...existing, tastes };
    try {
      await api.put('/users/me', {
        name: user.name,
        title: user.title || '',
        bio: user.bio || '',
        avatar: user.avatar || '',
        drinks: nextDrinks,
        onboarded: false, // keep the gate closed until Finish
      });
      track('onboarding_tastes_saved', { count: tastes.length });
    } catch (e) {
      // Non-fatal — we still let the user proceed; complete() will re-save.
      // Surface it so a network hiccup doesn't stay silent.
      toast?.show(e?.safeMessage || 'Could not save your picks — we’ll try again.', 'error');
    }
  }, [user, tastes, toast]);

  const onTasteNext = useCallback(async () => {
    if (tastes.length > 0) await persistTastes();
    goNext();
  }, [tastes.length, persistTastes, goNext]);

  const onEnablePush = useCallback(async () => {
    setPushing(true);
    try {
      const res = await enablePush();
      if (res?.ok) {
        setPushStatus('granted');
        toast?.show('Notifications are on. See you at the bar.', 'success');
        track('onboarding_push_enabled', {});
      } else if (res?.reason === 'denied') {
        setPushStatus('denied');
        toast?.show('You can turn notifications on later from Account.', 'info');
      } else if (res?.reason === 'simulator') {
        // Never nag on the simulator — silently move on.
        setPushStatus('granted');
      } else {
        toast?.show('Could not turn notifications on. You can try again later.', 'error');
      }
    } finally {
      setPushing(false);
    }
  }, [toast]);

  const finish = useCallback(async () => {
    if (finishing) return;
    setFinishing(true);
    try {
      // Persist any tastes that weren't saved yet (e.g. user skipped step 2 and
      // came back, or step 2 save failed on a hiccup). Also durably store the
      // taste picks alongside the flip so a rollback of /complete still keeps
      // the user's picks.
      if (user?.name) {
        const existing = parseDrinks(user?.drinks);
        try {
          await api.put('/users/me', {
            name: user.name,
            title: user.title || '',
            bio: user.bio || '',
            avatar: user.avatar || '',
            drinks: { ...existing, tastes },
            onboarded: true,
          });
        } catch (_) { /* /complete below is the source of truth for the flag */ }
      }
      await api.post('/onboarding/complete');
      track('onboarding_complete', {
        tastes: tastes.length,
        followed: Object.values(followed).filter(Boolean).length,
        push: pushStatus === 'granted',
      });
      // Trigger the navigator to re-evaluate the gate. This unmounts us.
      await refresh();
    } catch (e) {
      toast?.show(e?.safeMessage || 'Could not finish setup. Try again in a moment.', 'error');
      setFinishing(false);
    }
  }, [finishing, user, tastes, followed, pushStatus, refresh, toast]);

  const canGoBack = step > 1;

  const header = (
    <View style={styles.headerRow}>
      <Pressable
        onPress={() => setStep((s) => Math.max(1, s - 1))}
        hitSlop={12}
        style={{ opacity: canGoBack ? 1 : 0 }}
        accessibilityLabel="Go back"
        accessibilityRole="button"
        disabled={!canGoBack}
      >
        <Icon name="chevron-back" size={26} color={t.text} />
      </Pressable>
      <Text style={[type.caption, { color: t.textMuted }]}>
        Step {step} of {TOTAL}
      </Text>
      {step < TOTAL ? (
        <Pressable onPress={goSkip} hitSlop={12} accessibilityLabel="Skip this step" accessibilityRole="button">
          <Text style={[type.label, { color: t.textSecondary }]}>Skip</Text>
        </Pressable>
      ) : (
        <View style={{ width: 40 }} />
      )}
    </View>
  );

  return (
    <Screen edges={['top', 'bottom']}>
      {header}
      <ProgressDots step={step} total={TOTAL} />

      <StepTransition step={step} style={{ flex: 1 }}>
        {step === 1 && <StepWelcome onNext={goNext} />}
        {step === 2 && (
          <StepTaste
            selected={tastes}
            onToggle={toggleTaste}
            onNext={onTasteNext}
          />
        )}
        {step === 3 && (
          <StepPeople
            suggestions={suggestions}
            followed={followed}
            onToggleFollow={toggleFollow}
            error={suggestErr}
            onRetry={() => { setSuggestions(null); setSuggestErr(false); loadSuggestions(); }}
            onNext={goNext}
          />
        )}
        {step === 4 && (
          <StepFinish
            pushStatus={pushStatus}
            pushing={pushing}
            finishing={finishing}
            onEnablePush={onEnablePush}
            onFinish={finish}
          />
        )}
      </StepTransition>
    </Screen>
  );
}

/* ------------------------------------------------------------------ */
/*  Step 1 — Welcome                                                  */
/* ------------------------------------------------------------------ */

function StepWelcome({ onNext }) {
  const { t } = useTheme();
  return (
    <View style={{ flex: 1 }}>
      <View style={styles.welcomeBody}>
        <View style={{ flex: 1 }} />
        <WelcomeArt />
        <View style={{ paddingHorizontal: 28, marginTop: 26 }}>
          <Text style={[type.display, { color: t.text, textAlign: 'center' }]}>
            Stories start here.
          </Text>
          <Text
            style={[type.body, { color: t.textSecondary, textAlign: 'center', marginTop: 12, lineHeight: 22 }]}
          >
            Your people. Your places. Your stories. DrinkedInn is for the
            moments worth remembering — not the count.
          </Text>
        </View>
        <View style={{ flex: 1.2 }} />
      </View>
      <FloatingFooter column>
        <Button label="Get started" onPress={onNext} size="lg" full />
      </FloatingFooter>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/*  Step 2 — Taste                                                    */
/* ------------------------------------------------------------------ */

function StepTaste({ selected, onToggle, onNext }) {
  const { t } = useTheme();
  const count = selected.length;

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        <View style={styles.copy}>
          <Text style={[type.h1, { color: t.text }]}>What's your thing?</Text>
          <Text style={[type.body, { color: t.textSecondary, marginTop: 8, lineHeight: 22 }]}>
            Pick a few so we can bring the right people and places to your feed.
            Change anything, any time.
          </Text>
        </View>

        <TasteChipGrid options={TASTE_OPTIONS} value={selected} onToggle={onToggle} />

        <Text style={[type.caption, { color: t.textMuted, marginTop: 22, marginHorizontal: 20, lineHeight: 18 }]}>
          Zero-proof shows up first because we treat it as its own scene, not a
          fallback. Curious about wine? Coffee? Sake? Pick as many as feel right.
        </Text>
      </ScrollView>

      <FloatingFooter>
        <Text style={[type.caption, { color: t.textMuted }]}>
          {count === 0 ? 'Pick a few, or skip and we’ll learn as you go.' : `${count} picked`}
        </Text>
        <Button label={count === 0 ? 'Next' : 'Save picks'} onPress={onNext} size="md" />
      </FloatingFooter>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/*  Step 3 — People                                                   */
/* ------------------------------------------------------------------ */

function StepPeople({ suggestions, followed, onToggleFollow, error, onRetry, onNext }) {
  const { t } = useTheme();

  const loading = suggestions === null;
  const followingCount = useMemo(
    () => Object.values(followed).filter(Boolean).length,
    [followed]
  );

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        <View style={styles.copy}>
          <Text style={[type.h1, { color: t.text }]}>Find your people</Text>
          <Text style={[type.body, { color: t.textSecondary, marginTop: 8, lineHeight: 22 }]}>
            A few regulars to get you started. Follow whoever catches your eye
            — you can always come back and change your mind.
          </Text>
        </View>

        {loading ? (
          <View style={{ marginTop: 6 }}>
            {[0, 1, 2, 3, 4].map((i) => <SuggestionSkeleton key={i} />)}
          </View>
        ) : suggestions.length === 0 ? (
          error ? (
            <EmptyBlock
              icon="cloud-offline-outline"
              title="Couldn't reach the bar"
              body="We couldn't load suggestions right now. Give it another try."
              actionLabel="Try again"
              onAction={onRetry}
            />
          ) : (
            <EmptyBlock
              icon="people-outline"
              title="Quiet in here"
              body="No suggestions yet. Skip ahead — you'll find people from Discover once you're in."
            />
          )
        ) : (
          <View style={{ marginTop: 6 }}>
            {suggestions.map((p) => (
              <SuggestionRow
                key={p.id}
                person={p}
                following={!!followed[p.id]}
                onChange={onToggleFollow}
              />
            ))}
          </View>
        )}
      </ScrollView>

      <FloatingFooter>
        <Text style={[type.caption, { color: t.textMuted }]}>
          {followingCount > 0
            ? `Following ${followingCount}`
            : 'You can find more from Discover later.'}
        </Text>
        <Button label={followingCount > 0 ? 'Next' : 'Continue'} onPress={onNext} size="md" />
      </FloatingFooter>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/*  Step 4 — Notifications & finish                                   */
/* ------------------------------------------------------------------ */

function StepFinish({ pushStatus, pushing, finishing, onEnablePush, onFinish }) {
  const { t } = useTheme();

  const granted = pushStatus === 'granted';
  const denied = pushStatus === 'denied';

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 140 }}
      >
        <View style={styles.copy}>
          <Text style={[type.h1, { color: t.text }]}>Stay in the loop</Text>
          <Text style={[type.body, { color: t.textSecondary, marginTop: 8, lineHeight: 22 }]}>
            Get a nudge when someone raises a glass to your pour, or replies to
            you. Nothing else — no marketing, no noise.
          </Text>
        </View>

        <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.border }]}>
          <BenefitRow
            icon="chatbubble-ellipses-outline"
            title="Replies and mentions"
            body="Hear it when someone joins your conversation."
          />
          <Divider />
          <BenefitRow
            icon="heart-outline"
            title="Cheers on your pours"
            body="A quiet ping when your moments land."
          />
          <Divider />
          <BenefitRow
            icon="people-outline"
            title="New follows"
            body="Know when someone starts following along."
          />
        </View>

        {denied && (
          <View style={[styles.hint, { backgroundColor: t.dangerSoft, borderColor: t.border }]}>
            <Icon name="information-circle-outline" size={17} color={t.danger} />
            <Text style={[type.caption, { color: t.text, flex: 1, lineHeight: 18 }]}>
              Notifications are off in your device settings. You can turn them
              on later from Account → Notifications.
            </Text>
          </View>
        )}

        {granted && (
          <View style={[styles.hint, { backgroundColor: t.successSoft, borderColor: t.border }]}>
            <Icon name="checkmark-circle-outline" size={17} color={t.success} />
            <Text style={[type.caption, { color: t.text, flex: 1, lineHeight: 18 }]}>
              You're set. We’ll only reach out when it matters.
            </Text>
          </View>
        )}
      </ScrollView>

      <FloatingFooter column>
        {!granted && !denied ? (
          <Button
            label="Turn on notifications"
            onPress={onEnablePush}
            loading={pushing}
            icon="notifications-outline"
            size="lg"
            full
          />
        ) : null}
        <Button
          label={granted || denied ? 'Finish' : 'Not right now'}
          onPress={onFinish}
          variant={granted || denied ? 'primary' : 'secondary'}
          loading={finishing}
          size="lg"
          full
        />
      </FloatingFooter>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/*  Small helpers                                                     */
/* ------------------------------------------------------------------ */

function BenefitRow({ icon, title, body }) {
  const { t } = useTheme();
  return (
    <View style={styles.benefit}>
      <View style={[styles.benefitIcon, { backgroundColor: t.accentSoft }]}>
        <Icon name={icon} size={18} color={t.accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[type.bodyStrong, { color: t.text }]}>{title}</Text>
        <Text style={[type.caption, { color: t.textSecondary, marginTop: 3, lineHeight: 17 }]}>
          {body}
        </Text>
      </View>
    </View>
  );
}

function Divider() {
  const { t } = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: t.divider, marginLeft: 60 }} />;
}

function EmptyBlock({ icon, title, body, actionLabel, onAction }) {
  const { t } = useTheme();
  return (
    <View style={{ alignItems: 'center', paddingTop: 30, paddingHorizontal: 32 }}>
      <View
        style={{
          width: 60, height: 60, borderRadius: radius.xl,
          backgroundColor: t.accentSoft, alignItems: 'center', justifyContent: 'center',
          marginBottom: 14,
        }}
      >
        <Icon name={icon} size={26} color={t.accent} />
      </View>
      <Text style={[type.h3, { color: t.text, textAlign: 'center' }]}>{title}</Text>
      <Text style={[type.body, { color: t.textSecondary, textAlign: 'center', marginTop: 6, lineHeight: 22 }]}>
        {body}
      </Text>
      {!!actionLabel && (
        <View style={{ marginTop: 14 }}>
          <Button label={actionLabel} onPress={onAction} size="md" variant="secondary" />
        </View>
      )}
    </View>
  );
}

function FloatingFooter({ children, column }) {
  const { t } = useTheme();
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fade, { toValue: 1, duration: 260, useNativeDriver: true }).start();
  }, [fade]);

  return (
    <Animated.View
      style={[
        styles.footer,
        {
          backgroundColor: t.bg,
          borderTopColor: t.divider,
          opacity: fade,
        },
        column && { flexDirection: 'column', alignItems: 'stretch', gap: 10 },
      ]}
    >
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 6,
    minHeight: 40,
  },
  welcomeBody: { flex: 1, alignItems: 'center' },
  copy: { paddingHorizontal: 20, paddingTop: 28, paddingBottom: 22 },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 18,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  card: {
    marginHorizontal: 16,
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 4,
  },
  benefit: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
  },
  benefitIcon: {
    width: 34, height: 34, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  hint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 16,
    marginTop: 14,
    padding: 12,
    borderRadius: radius.md,
    borderWidth: 1,
  },
});

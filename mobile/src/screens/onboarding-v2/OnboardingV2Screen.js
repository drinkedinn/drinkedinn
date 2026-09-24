// src/screens/onboarding-v2/OnboardingV2Screen.js
// Shortened first-run flow. Rendered by the navigator gate when a user is
// signed in but !user.onboarded.
//
//   1  Welcome      — brand promise, one button
//   2  Age + place  — date of birth and country (both required to continue)
//   3  Acceptance   — Terms / Community Guidelines / Child Safety + one checkbox
//   4  Interests    — broad life interests, >= 3, POST /onboarding/interests
//   5  People       — GET /onboarding/suggestions, one-tap follow
//   6  Finish       — optional push, then POST /onboarding/complete + refresh()
//
// Compliance notes, because they are the reason several things here look the
// way they do rather than the convenient way:
//   · Step 3 is the Play requirement for a UGC app — an explicit, unchecked-by-
//     default acceptance, with the policies reachable in-app. It has no Skip.
//   · Step 4 carries no alcohol-specific interests. Drink-level personalisation
//     lives in Collection and Explore, after the person is actually using the
//     app. Opening with a grid of spirits reads as an alcohol-first product.
//   · Step 5 never touches the address book. READ_CONTACTS is a Play
//     declaration liability and the server already suggests people; there is no
//     contact upload, import or scan anywhere in this flow.
//   · Step 6 does not ask for location: expo-location is not a dependency of
//     this app, and the brief says to drop the ask rather than add a package.
//   · Every suggested person is user-generated content, so each row carries
//     report + block via showReportSheet (never a >2-button Alert).
//
// Progress is mirrored into AsyncStorage on every change, so a crash or a
// force-quit mid-flow resumes on the same step with the same answers.

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, StyleSheet, BackHandler, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import api from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../theme/ThemeContext';
import { Screen, Button, useToast } from '../../components/ui';
import { enablePush, getPermissionStatus } from '../../lib/pushNotifications';
import track from '../../lib/track';
import * as haptics from '../../ui/haptics';

import StepShell from '../../components/onboarding-v2/StepShell';
import { isOfAge, isUnderAge, MIN_AGE } from '../../components/onboarding-v2/DobField';
import { FootNote } from '../../components/onboarding-v2/Bits';
import {
  WelcomeStep, AgeStep, ConsentStep, InterestsStep, PeopleStep, FinishStep,
} from '../../components/onboarding-v2/StepBodies';

import { INTERESTS, MIN_INTERESTS } from './interests';
import { countryByCode } from './countries';
import { loadState, saveState, clearState, emptyState } from './onboardingState';
import useSuggestedPeople from './useSuggestedPeople';

const TOTAL = 6;

// `drinks` arrives as a JSON string or an already-parsed object depending on
// where the user object came from. Everything downstream wants an object.
function parseDrinks(raw) {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

const pad = (v) => String(v || '').padStart(2, '0');

export default function OnboardingV2Screen() {
  const { t } = useTheme();
  const { user, refresh } = useAuth();
  const toast = useToast();

  const [hydrated, setHydrated] = useState(false);
  const [step, setStep] = useState(1);
  // The legal minimum is per-country and decided by the SERVER
  // (server/lib/jurisdictions.js). Hardcoding 18 told a US member they were in
  // an "18+ community" when the server would refuse them until 21, and India's
  // minimum is 25. Resolve it for the chosen country and fall back to the 18
  // floor only while the call is in flight.
  const [minAge, setMinAge] = useState(MIN_AGE);
  const [dob, setDob] = useState(() => emptyState().dob);
  const [countryCode, setCountryCode] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [interests, setInterests] = useState([]);
  const [savingInterests, setSavingInterests] = useState(false);

  // Step 5 — loading, following, reporting and blocking all live in the hook.
  const people = useSuggestedPeople();
  const { load: loadPeople, setFollowed: seedFollowed, followCount } = people;

  const [pushStatus, setPushStatus] = useState('undetermined');
  const [pushing, setPushing] = useState(false);
  const [finishing, setFinishing] = useState(false);

  /* ── draft: restore, then mirror every change ───────────────────────────── */

  useEffect(() => {
    const cc = country?.code;
    if (!cc) { setMinAge(MIN_AGE); return; }
    let alive = true;
    api.get(`/auth/rules?country=${encodeURIComponent(cc)}`)
      .then((r) => { if (alive && r?.data?.minAge) setMinAge(r.data.minAge); })
      .catch(() => { /* keep the floor; the server re-checks at register anyway */ });
    return () => { alive = false; };
  }, [country?.code]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const saved = await loadState();
      if (!alive) return;
      setStep(saved.step);
      setDob(saved.dob);
      setCountryCode(saved.countryCode);
      setAccepted(saved.accepted);
      setInterests(saved.interests);
      // The server already hides people you follow, so this only keeps the
      // running count honest across a resume.
      seedFollowed(Object.fromEntries(saved.followedIds.map((id) => [id, true])));
      setHydrated(true);
      track('onboarding_v2_view', { step: saved.step, resumed: saved.step > 1 });
    })();
    return () => { alive = false; };
  }, [seedFollowed]);

  useEffect(() => {
    if (!hydrated) return;
    saveState({
      step,
      dob,
      countryCode,
      accepted,
      interests,
      followedIds: Object.keys(people.followed).filter((id) => people.followed[id]).map(Number),
    });
  }, [hydrated, step, dob, countryCode, accepted, interests, people.followed]);

  /* ── navigation between steps ───────────────────────────────────────────── */

  const goBack = useCallback(() => setStep((s) => Math.max(1, s - 1)), []);

  const goNext = useCallback(() => {
    haptics.tap();
    setStep((s) => {
      const next = Math.min(TOTAL, s + 1);
      track('onboarding_v2_next', { from: s, to: next });
      return next;
    });
  }, []);

  const goSkip = useCallback(() => {
    setStep((s) => {
      const next = Math.min(TOTAL, s + 1);
      track('onboarding_v2_skip', { from: s, to: next });
      return next;
    });
  }, []);

  // Android hardware back walks the flow backwards and is swallowed at step 1 —
  // there is nowhere behind onboarding to land.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (step > 1) goBack();
      return true;
    });
    return () => sub.remove();
  }, [step, goBack]);

  /* ── step 2: age + country ──────────────────────────────────────────────── */

  const underAge = isUnderAge(dob, minAge);
  const ageOk = isOfAge(dob, minAge);
  const country = countryByCode(countryCode);
  const canPassAge = ageOk && !!country;

  // Only complain once all three boxes are filled — nobody should be told their
  // date is wrong while they are still halfway through typing it.
  const dobComplete = dob.d.length > 0 && dob.m.length > 0 && dob.y.length === 4;
  const dobError = underAge
    ? `You need to be ${minAge} or older to join from ${country?.name || 'your country'}.`
    : dobComplete && !ageOk
      ? "That date doesn't look right — check the day, month and year."
      : null;

  /* ── step 3: acceptance, recorded as soon as it is given ────────────────── */

  // The API has no dedicated consent endpoint, so the record rides along in the
  // profile blob that PUT /users/me already owns. Best-effort on purpose: a
  // network hiccup must not strand someone on the acceptance screen, and
  // finish() writes it again before completing.
  const persistProfile = useCallback(async () => {
    if (!user?.name) return;
    const existing = parseDrinks(user.drinks);
    await api.put('/users/me', {
      name: user.name,
      title: user.title || '',
      bio: user.bio || '',
      avatar: user.avatar || '',
      // Date of birth and country go to their REAL columns, which the age gate
      // and every jurisdiction decision actually read. They were previously
      // buried in a `drinks.age_gate` blob that no server code looks at, so the
      // whole step was collecting data into a void. The server treats both as
      // write-once and re-validates them, so this cannot be used to change an
      // age that is already set.
      date_of_birth: ageOk ? `${dob.y}-${pad(dob.m)}-${pad(dob.d)}` : undefined,
      country_code: country?.code || undefined,
      drinks: {
        ...existing,
        // Consent has no column of its own yet; keeping the record here is
        // better than losing it, and it is genuinely profile metadata.
        consent: {
          accepted_terms: !!accepted,
          accepted_at: accepted ? new Date().toISOString() : null,
          flow: 'onboarding_v2',
        },
      },
      onboarded: false, // the gate stays closed until /onboarding/complete
    });
  }, [user, dob, ageOk, country, accepted]);

  const onAccept = useCallback(async () => {
    if (!accepted) return;
    haptics.press();
    track('onboarding_v2_terms_accepted', { age_given: ageOk, country: country?.code || null });
    try {
      await persistProfile();
    } catch (e) {
      toast?.show(e?.safeMessage || "We'll save that in a moment.", 'error');
    }
    goNext();
  }, [accepted, ageOk, country, persistProfile, goNext, toast]);

  /* ── step 4: interests ──────────────────────────────────────────────────── */

  const interestsSaved = useRef(false);

  const toggleInterest = useCallback((key) => {
    interestsSaved.current = false; // picks changed — the saved copy is stale
    setInterests((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }, []);

  const postInterests = useCallback(async () => {
    if (interestsSaved.current || interests.length < MIN_INTERESTS) return;
    // home_city belongs to this endpoint's contract and is overwritten on every
    // call. This flow asks for a country, not a city, so it goes up empty
    // rather than filled with the wrong kind of place.
    await api.post('/onboarding/interests', { interests, home_city: '' });
    interestsSaved.current = true;
    track('onboarding_v2_interests_saved', { count: interests.length });
  }, [interests]);

  const onInterestsNext = useCallback(async () => {
    if (interests.length < MIN_INTERESTS || savingInterests) return;
    setSavingInterests(true);
    try {
      await postInterests();
      haptics.pop();
      goNext();
    } catch (e) {
      toast?.show(e?.safeMessage || 'Could not save your picks.', 'error');
    } finally {
      setSavingInterests(false);
    }
  }, [interests.length, savingInterests, postInterests, goNext, toast]);

  /* ── step 5: people ─────────────────────────────────────────────────────── */

  // Warm the list one step early so step 5 lands instantly.
  useEffect(() => {
    if (hydrated && step >= 4 && people.suggestions === null) loadPeople();
  }, [hydrated, step, people.suggestions, loadPeople]);

  /* ── step 6: push, then complete ────────────────────────────────────────── */

  useEffect(() => {
    if (step !== TOTAL) return;
    let alive = true;
    (async () => {
      const status = await getPermissionStatus();
      if (alive) setPushStatus(status);
    })();
    return () => { alive = false; };
  }, [step]);

  const onEnablePush = useCallback(async () => {
    setPushing(true);
    try {
      const res = await enablePush();
      if (res?.ok) {
        setPushStatus('granted');
        haptics.pop();
        toast?.show("Notifications are on. We'll only reach out when it matters.", 'success');
        track('onboarding_v2_push', { granted: true });
      } else if (res?.reason === 'denied') {
        setPushStatus('denied');
        toast?.show('You can turn these on later from Account.', 'info');
        track('onboarding_v2_push', { granted: false });
      } else if (res?.reason === 'simulator') {
        setPushStatus('unsupported');
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
      // Catch up on anything a skip or a flaky moment left unsaved. Neither is
      // fatal — /complete is what actually opens the gate.
      try { await persistProfile(); } catch {}
      try { await postInterests(); } catch {}
      await api.post('/onboarding/complete');
      track('onboarding_v2_complete', {
        interests: interests.length,
        follows: followCount,
        push: pushStatus === 'granted',
        country: country?.code || null,
      });
      await clearState();
      // Flips user.onboarded, which re-renders the navigator and unmounts us.
      await refresh();
    } catch (e) {
      toast?.show(e?.safeMessage || 'Could not finish setup. Try again in a moment.', 'error');
      setFinishing(false);
    }
  }, [finishing, persistProfile, postInterests, interests.length, followCount, pushStatus, country, refresh, toast]);

  /* ── footer, one shape per step ───────────────────────────────────────── */

  function renderFooter() {
    if (step === 1) {
      return <Button label="Get started" onPress={goNext} size="lg" full />;
    }
    if (step === 2) {
      return (
        <>
          <FootNote>
            {underAge
              ? "We're sorry — you'll be welcome when you're older."
              : canPassAge
                ? `${country.name} · ${minAge}+`
                : 'Both are needed to continue.'}
          </FootNote>
          <Button label="Continue" onPress={goNext} disabled={!canPassAge} size="lg" full />
        </>
      );
    }
    if (step === 3) {
      return (
        <>
          <FootNote>{accepted ? 'Thank you.' : 'Tick the box above to continue.'}</FootNote>
          <Button label="Agree and continue" onPress={onAccept} disabled={!accepted} size="lg" full />
        </>
      );
    }
    if (step === 4) {
      const remaining = MIN_INTERESTS - interests.length;
      return (
        <>
          <FootNote>
            {remaining > 0 ? `Pick ${remaining} more` : `${interests.length} picked`}
          </FootNote>
          <Button
            label="Continue"
            onPress={onInterestsNext}
            disabled={interests.length < MIN_INTERESTS}
            loading={savingInterests}
            size="lg"
            full
          />
        </>
      );
    }
    if (step === 5) {
      return (
        <>
          <FootNote>
            {followCount > 0 ? `Following ${followCount}` : 'Follow whoever catches your eye.'}
          </FootNote>
          <Button label="Continue" onPress={goNext} size="lg" full />
        </>
      );
    }
    const decided = pushStatus === 'granted' || pushStatus === 'denied' || pushStatus === 'unsupported';
    return (
      <>
        {!decided && (
          <Button
            label="Turn on notifications"
            onPress={onEnablePush}
            loading={pushing}
            icon="notifications-outline"
            size="lg"
            full
          />
        )}
        <Button
          label={decided ? "Let's go" : 'Not now'}
          onPress={finish}
          variant={decided ? 'primary' : 'secondary'}
          loading={finishing}
          size="lg"
          full
        />
      </>
    );
  }

  /* ── render ─────────────────────────────────────────────────────────────── */

  if (!hydrated) {
    return (
      <Screen edges={['top', 'bottom']}>
        <View style={styles.center}>
          <ActivityIndicator color={t.accent} size="large" />
        </View>
      </Screen>
    );
  }

  // Step 1's only forward action is the button itself. Steps 3 (consent) and 6
  // must be resolved. Step 2 is the AGE GATE and must not be skippable either:
  // offering Skip while the fields were still blank let the whole age + country
  // step be bypassed with one tap, which is the opposite of what it is for.
  // Skip therefore belongs to steps 4 and 5 only.
  const onSkip = step === 4 || step === 5 ? goSkip : null;

  return (
    <Screen edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <StepShell
          step={step}
          total={TOTAL}
          onBack={step > 1 ? goBack : null}
          onSkip={onSkip}
          footer={renderFooter()}
        >
          {step === 1 && <WelcomeStep />}

          {step === 2 && (
            <AgeStep
              dob={dob}
              onDobChange={setDob}
              dobError={dobError}
              countryCode={countryCode}
              onCountryChange={setCountryCode}
              complete={canPassAge}
            />
          )}

          {step === 3 && (
            <ConsentStep
              accepted={accepted}
              onToggle={(next) => { haptics.tap(); setAccepted(next); }}
              onPolicyOpened={(doc) => track('onboarding_v2_policy_opened', { doc })}
            />
          )}

          {step === 4 && (
            <InterestsStep
              options={INTERESTS}
              selected={interests}
              onToggle={toggleInterest}
              minimum={MIN_INTERESTS}
            />
          )}

          {step === 5 && (
            <PeopleStep
              suggestions={people.suggestions}
              failed={people.failed}
              followed={people.followed}
              busyIds={people.busyIds}
              refreshing={people.refreshing}
              onRefresh={people.refresh}
              onRetry={people.retry}
              onToggleFollow={people.toggleFollow}
              onOpenMenu={people.openMenu}
            />
          )}

          {step === 6 && <FinishStep pushStatus={pushStatus} />}
        </StepShell>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});

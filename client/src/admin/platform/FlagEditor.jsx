// client/src/admin/platform/FlagEditor.jsx
//
// One flag, editable. Real inputs for targeting rather than a JSON textarea:
// a typo in hand-written JSON is stored, truncated or silently dropped by the
// server's try/catch, and nobody finds out until the flag behaves wrongly.
//
// Mount with key={flag.key} so switching rows resets the draft.

import { useId, useMemo, useState } from 'react';
import { C, btn } from './theme';
import { Card, Field, TextInput, TextArea, CheckRow, ReasonField, ErrorBlock, Note, Mono } from './ui';
import {
  parseTargeting, parseIdList, parseCountryList, buildTargeting, explainDraft,
  TARGETING_MAX_JSON, DESCRIPTION_MAX, REASON_MIN,
} from './targeting';
import { saveFlag } from './flagsApi';
import { apiError } from './errors';

const TONE_COLOR = { off: C.red, warn: C.amber, info: C.accentHi };

export default function FlagEditor({ flag, onCancel, onSaved, onRequestKill }) {
  const uid = useId();
  const stored = useMemo(() => parseTargeting(flag?.targeting), [flag?.targeting]);

  const [enabled, setEnabled]         = useState(!!flag?.enabled);
  const [rollout, setRollout]         = useState(String(Number(flag?.rollout_pct) || 0));
  const [idsText, setIdsText]         = useState(stored.user_ids.join(', '));
  const [codesText, setCodesText]     = useState(stored.countries.join(', '));
  const [staffOnly, setStaffOnly]     = useState(stored.staff_only);
  const [description, setDescription] = useState(flag?.description || '');
  const [reason, setReason]           = useState('');
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState(null);

  const { ids, bad: badIds }      = useMemo(() => parseIdList(idsText), [idsText]);
  const { codes, bad: badCodes }  = useMemo(() => parseCountryList(codesText), [codesText]);
  const built = useMemo(
    () => buildTargeting({ ids, codes, staffOnly, extra: stored.extra }),
    [ids, codes, staffOnly, stored.extra]
  );

  const rolloutNum = /^\d{1,3}$/.test(rollout.trim()) ? Number(rollout.trim()) : NaN;
  const rolloutBad = Number.isNaN(rolloutNum) || rolloutNum < 0 || rolloutNum > 100;
  const reasonLen  = reason.trim().length;

  const fieldErrors = {
    rollout: rolloutBad ? 'Enter a whole number from 0 to 100.' : null,
    ids: badIds.length ? `Not user ids: ${badIds.slice(0, 5).join(', ')}${badIds.length > 5 ? '…' : ''}. Numeric ids only.` : null,
    codes: badCodes.length ? `Not country codes: ${badCodes.slice(0, 5).join(', ')}${badCodes.length > 5 ? '…' : ''}. Two letters each, e.g. GB.` : null,
    description: description.length > DESCRIPTION_MAX ? `${description.length}/${DESCRIPTION_MAX} — the server stores only the first ${DESCRIPTION_MAX} characters.` : null,
    targeting: built.tooBig ? `Targeting is ${built.size} characters; the server stores at most ${TARGETING_MAX_JSON} and a longer value is truncated into unreadable JSON, which drops ALL targeting. Shorten the allow-list.` : null,
  };
  const hasFieldError = Object.values(fieldErrors).some(Boolean);
  const canSubmit = !saving && !hasFieldError && reasonLen >= REASON_MIN;

  const turningOff = !!flag?.enabled && !enabled;
  const explanation = explainDraft({ enabled, rolloutPct: rolloutBad ? 0 : rolloutNum, ids, codes, staffOnly });

  const submit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSaving(true); setError(null);
    try {
      await saveFlag(flag.key, {
        enabled,
        rollout_pct: rolloutNum,
        targeting: built.obj,
        description,
        reason: reason.trim(),
      });
      onSaved?.();
    } catch (err) {
      setError(apiError(err, 'Could not save that flag. Nothing was changed.'));
      setSaving(false);
    }
  };

  const labelStyle = { fontSize: 11.5, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 };

  return (
    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

      {stored.malformed && (
        <Note icon="⚠️" tone="red">
          The stored targeting for <Mono>{flag.key}</Mono> is not readable JSON, so the app is currently evaluating it as
          <strong> no targeting at all</strong>. Saving replaces it with the values below.
        </Note>
      )}

      {/* ── State + rollout ─────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 1fr) minmax(260px, 1.2fr)', gap: 20 }}>
        <div>
          <div style={{ ...labelStyle, marginBottom: 8 }}>State</div>
          <CheckRow
            id={`${uid}-enabled`}
            checked={enabled}
            onChange={setEnabled}
            label={enabled ? 'Enabled' : 'Disabled'}
            hint="Disabled beats everything below — allow-list included."
          />
          {turningOff && (
            <div style={{ marginTop: 10, fontSize: 11.5, color: C.amber, lineHeight: 1.5 }}>
              Saving this turns the flag off for everyone — the same outcome as the kill switch, minus the reset to 0%.
            </div>
          )}
        </div>

        <Field
          label="Rollout percent"
          htmlFor={`${uid}-rollout`}
          error={fieldErrors.rollout}
          hint={staffOnly ? 'Not consulted while staff-only is on.' : 'Share of everyone not already decided by the rules above.'}
        >
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <input
              id={`${uid}-rollout-range`}
              type="range"
              min={0}
              max={100}
              step={1}
              value={rolloutBad ? 0 : rolloutNum}
              onChange={(e) => setRollout(e.target.value)}
              aria-label="Rollout percent slider"
              style={{ flex: 1, accentColor: C.accent, cursor: 'pointer' }}
            />
            <TextInput
              id={`${uid}-rollout`}
              type="number"
              min={0}
              max={100}
              step={1}
              inputMode="numeric"
              value={rollout}
              invalid={!!fieldErrors.rollout}
              onChange={(e) => setRollout(e.target.value)}
              style={{ width: 88, flex: '0 0 auto', textAlign: 'right' }}
            />
            <span style={{ color: C.textMuted, fontSize: 13, fontWeight: 700 }}>%</span>
          </div>
        </Field>
      </div>

      {/* ── Targeting ───────────────────────────────────────────────────── */}
      <div>
        <div style={{ ...labelStyle, marginBottom: 10 }}>Targeting</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
          <Field
            label="Allow-listed user ids"
            htmlFor={`${uid}-ids`}
            error={fieldErrors.ids}
            hint={ids.length
              ? `${ids.length} id${ids.length > 1 ? 's' : ''}. Always on for them while the flag is enabled.`
              : 'Numeric ids, comma or space separated. Leave empty for none.'}
          >
            <TextArea
              id={`${uid}-ids`}
              rows={2}
              value={idsText}
              invalid={!!fieldErrors.ids}
              onChange={(e) => setIdsText(e.target.value)}
              placeholder="e.g. 1, 42, 108"
            />
          </Field>

          <Field
            label="Countries"
            htmlFor={`${uid}-countries`}
            error={fieldErrors.codes}
            hint={codes.length
              ? `Only ${codes.join(', ')}. Everyone else is excluded.`
              : 'Two-letter codes, e.g. GB IE US. Leave empty for no country restriction.'}
          >
            <TextArea
              id={`${uid}-countries`}
              rows={2}
              value={codesText}
              invalid={!!fieldErrors.codes}
              onChange={(e) => setCodesText(e.target.value)}
              placeholder="e.g. GB, IE"
            />
          </Field>
        </div>

        <div style={{ marginTop: 14 }}>
          <CheckRow
            id={`${uid}-staff`}
            checked={staffOnly}
            onChange={setStaffOnly}
            label="Staff only"
            hint="Admins only — and the rollout percent stops being used entirely."
          />
        </div>

        {Object.keys(stored.extra).length > 0 && (
          <div style={{ marginTop: 12, fontSize: 11.5, color: C.textFaint, lineHeight: 1.6 }}>
            Also stored: <Mono>{Object.keys(stored.extra).join(', ')}</Mono>. The server's evaluation ignores these keys; they are kept as-is when you save.
          </div>
        )}

        <div style={{ marginTop: 10, fontSize: 11.5, color: built.tooBig ? C.red : built.nearLimit ? C.amber : C.textFaint }}>
          Targeting payload {built.size}/{TARGETING_MAX_JSON} characters.
        </div>
        {fieldErrors.targeting && <div style={{ color: C.red, fontSize: 11.5, marginTop: 5, lineHeight: 1.5 }} role="alert">{fieldErrors.targeting}</div>}
      </div>

      {/* ── What this will do ───────────────────────────────────────────── */}
      <Card style={{ padding: '14px 18px', background: C.bg, borderColor: C.border }}>
        <div style={{ ...labelStyle, marginBottom: 10 }}>What this will do</div>
        <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 7 }}>
          {explanation.map((line, i) => (
            <li key={i} style={{ display: 'flex', gap: 9, alignItems: 'flex-start', fontSize: 12.5, lineHeight: 1.6, color: line.tone === 'off' ? C.textMuted : C.text }}>
              <span style={{ color: TONE_COLOR[line.tone] || C.textMuted, flexShrink: 0, fontWeight: 800 }} aria-hidden="true">•</span>
              <span>{line.text}</span>
            </li>
          ))}
        </ul>
      </Card>

      {/* ── Description ─────────────────────────────────────────────────── */}
      <Field
        label="Description"
        htmlFor={`${uid}-desc`}
        error={fieldErrors.description}
        hint={`Shown in this table only. ${description.length}/${DESCRIPTION_MAX} characters. Saving always rewrites it, so clearing it here clears it everywhere.`}
      >
        <TextInput
          id={`${uid}-desc`}
          value={description}
          invalid={!!fieldErrors.description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What does this flag control?"
        />
      </Field>

      {/* ── Reason (high impact) ────────────────────────────────────────── */}
      <ReasonField
        id={`${uid}-reason`}
        value={reason}
        onChange={setReason}
        disabled={saving}
        minLength={REASON_MIN}
        label="Reason for this change (required)"
      />

      {error && <ErrorBlock message={error} />}

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <button type="submit" disabled={!canSubmit} style={btn('primary', !canSubmit)}>
          {saving ? 'Saving…' : 'Save changes'}
        </button>
        <button type="button" onClick={onCancel} disabled={saving} style={btn('ghost', saving)}>Cancel</button>
        {!canSubmit && !saving && (
          <span style={{ fontSize: 11.5, color: C.textFaint }}>
            {hasFieldError ? 'Fix the highlighted fields to save.' : `A reason of at least ${REASON_MIN} characters is required.`}
          </span>
        )}
      </div>

      {/* ── Kill switch, deliberately apart from Save ───────────────────── */}
      <div style={{ border: `1px solid ${C.red}55`, background: C.red + '0d', borderRadius: 14, padding: '16px 18px', display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ fontSize: 12.5, fontWeight: 800, color: C.red, letterSpacing: 0.4, textTransform: 'uppercase', marginBottom: 5 }}>
            Kill switch
          </div>
          <div style={{ fontSize: 12.5, color: C.textMuted, lineHeight: 1.6 }}>
            One call: off for everyone and rollout reset to 0%, whatever is typed above. Use this during an incident — it does not
            need the form to be valid and it does not delete the flag.
          </div>
        </div>
        <button
          type="button"
          onClick={() => onRequestKill?.(flag)}
          disabled={!flag?.enabled}
          title={flag?.enabled ? undefined : 'This flag is already off.'}
          style={btn('kill', !flag?.enabled)}
        >
          {flag?.enabled ? 'Kill this flag' : 'Already off'}
        </button>
      </div>
    </form>
  );
}

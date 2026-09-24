// client/src/admin/command/CommandCentre.jsx
//
// The screen you leave open on a monitor. Everything here is an aggregate:
// counts of things that happened, never a list of who did them. That matches
// what GET /api/admin/command returns and it is the point of the panel — an
// ops console that quietly becomes a way to watch individual people is a
// different product, and a worse one.
//
// Props (all optional; supplied by the admin shell — see the panel notes):
//   role         string   the signed-in admin's role name, for messaging
//   permissions  string[] | Set<string> | null   their permission set
//
// When `permissions` is not supplied the panel asks the server who the caller
// is (GET /api/admin/roles/me) rather than guessing — see ./useAdminIdentity.
// If even that fails it renders optimistically and lets the server be the
// gate; a 403 is then shown with the server's own wording.

import { useEffect, useMemo } from 'react';
import api from '../../api';
import { C, MONO, num, count, clockTime } from './theme';
import { Card, Metric, Note, SectionLabel, ErrorNote, PermissionNote, PanelStyles, SkeletonLine } from './ui';
import { makeGate } from './permissions';
import useAdminIdentity from './useAdminIdentity';
import usePolling from './usePolling';
import FreshnessMeter from './FreshnessMeter';
import SignupsChart from './SignupsChart';
import CountryBars from './CountryBars';
import HealthStrip from './HealthStrip';

const REFRESH_MS = 30000;
const HEALTH_REFRESH_MS = 60000;

const fetchCommand = async () => (await api.get('/admin/command')).data;
const fetchHealth = async () => (await api.get('/admin/command/health')).data;

export default function CommandCentre({ role = null, permissions = null }) {
  const identity = useAdminIdentity({ role, permissions });
  const gate = useMemo(
    () => makeGate(identity.permissions, identity.role),
    [identity.permissions, identity.role],
  );

  const canSeeDashboard = !gate.denies('analytics.read');
  const canSeeHealth = !gate.denies('health.read');

  // Nothing is requested until we know who is asking. Firing first and reading
  // the permission set second would produce exactly the 403 this panel exists
  // to avoid.
  const main = usePolling(fetchCommand, { intervalMs: REFRESH_MS, enabled: canSeeDashboard && !identity.resolving });
  const health = usePolling(fetchHealth, { intervalMs: HEALTH_REFRESH_MS, enabled: canSeeHealth && !identity.resolving });

  // One pause control, both loops. Pausing the dashboard but leaving health
  // polling would make the "paused" label a lie.
  const mainPaused = main.paused;
  const setHealthPaused = health.setPaused;
  useEffect(() => { setHealthPaused(mainPaused); }, [mainPaused, setHealthPaused]);

  if (!canSeeDashboard && !identity.resolving) {
    return (
      <>
        <PanelStyles />
        <PermissionNote permission="analytics.read" role={gate.role} />
      </>
    );
  }

  const d = main.data || null;
  const live = d?.live || null;
  const today = d?.today || null;
  const totals = d?.totals || null;
  const safety = d?.safety || null;

  // count() returns null for a figure that did not arrive, so "0 open" and
  // "we don't know" never collapse into the same green number.
  const csae = count(safety?.csae_open);
  const csaeAlarm = csae != null && csae > 0;
  const openReports = count(safety?.open_reports) ?? 0;
  const unassigned = count(safety?.unassigned) ?? 0;

  const firstLoad = (main.loading || identity.resolving) && d == null;

  const refreshBoth = () => { main.refresh(); if (canSeeHealth) health.refresh(); };
  const togglePause = () => main.setPaused((p) => !p);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <PanelStyles />

      {/* ── Control bar ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: 1 }}>
          Live operations
        </div>
        {d?.generated_at && (
          <span style={{ fontSize: 10.5, color: C.textFaint, fontFamily: MONO }}>
            server time {clockTime(d.generated_at)}
          </span>
        )}
        <div style={{ marginLeft: 'auto' }}>
          <FreshnessMeter
            lastUpdated={main.lastUpdated}
            paused={main.paused}
            busy={main.busy}
            onTogglePause={togglePause}
            onRefresh={refreshBoth}
            intervalMs={REFRESH_MS}
            stale={Boolean(main.error) && main.lastUpdated != null}
          />
        </div>
      </div>

      {/* ── CSAE alarm. The one number that must never be ignored. ── */}
      {csaeAlarm && (
        <div
          className="di-cmd-alarm"
          role="status"
          style={{
            display: 'flex', alignItems: 'center', gap: 14,
            background: C.red + '1f', border: `1.5px solid ${C.red}`, borderRadius: 16, padding: '16px 20px',
          }}
        >
          <span aria-hidden="true" style={{ fontSize: 28 }}>🚨</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: C.red, letterSpacing: -0.2 }}>
              {num(csae)} open CSAE report{csae === 1 ? '' : 's'}
            </div>
            <div style={{ fontSize: 12.5, color: C.textMuted, marginTop: 3, lineHeight: 1.6 }}>
              Child-safety reports are handled before anything else on this screen. Work them in the Reports queue now.
            </div>
          </div>
        </div>
      )}

      {/* ── A refresh failed, but keep the last good numbers on screen ── */}
      {main.error && (
        <ErrorNote
          message={
            main.forbidden
              ? `${main.error}${gate.role ? ` (your role: ${gate.role})` : ''}`
              : main.error
          }
          onRetry={main.refresh}
        />
      )}
      {main.error && d != null && (
        <Note icon="🕒" tone={C.amber}>
          The figures below are the last good read
          {main.lastUpdated ? <> from {clockTime(main.lastUpdated)}</> : null}. They are not current.
        </Note>
      )}

      {/* ── Top strip: LIVE + SAFETY ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(330px, 1fr))', gap: 16 }}>
        <Card style={{ padding: '16px 20px' }}>
          <SectionLabel right={<span style={{ fontSize: 10.5, color: C.textFaint, fontWeight: 600 }}>rolling 10 min</span>}>
            Live
          </SectionLabel>
          {firstLoad ? <LoadingRow n={3} /> : (
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <Metric label="Posts / 10m" value={live?.posts_10m} color={C.amber} />
              <Metric label="Messages / 10m" value={live?.messages_10m} color={C.accentHi} sub="count only" />
              <Metric label="Active today" value={live?.active_today} color={C.green} />
            </div>
          )}
        </Card>

        <Card style={{ padding: '16px 20px', borderColor: csaeAlarm ? C.red : openReports > 0 ? C.amber + '55' : C.border }}>
          <SectionLabel
            tone={csaeAlarm ? C.red : C.textMuted}
            right={<span style={{ fontSize: 10.5, color: C.textFaint, fontWeight: 600 }}>pending queue</span>}
          >
            Safety
          </SectionLabel>
          {firstLoad ? <LoadingRow n={3} /> : (
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <Metric label="Open reports" value={safety?.open_reports} color={openReports > 0 ? C.amber : C.text} />
              {/* "clear" is claimed only when the server actually said zero.
                  A missing figure is reported as missing — on this particular
                  number, guessing reassurance is the worst available error. */}
              <Metric
                label="CSAE open"
                value={safety?.csae_open}
                alarm={csaeAlarm}
                color={C.text}
                sub={csaeAlarm ? 'handle first' : csae === 0 ? 'clear' : 'not reported'}
              />
              <Metric label="Unassigned" value={safety?.unassigned} color={unassigned > 0 ? C.amber : C.text} sub={unassigned > 0 ? 'no owner yet' : undefined} />
            </div>
          )}
        </Card>
      </div>

      {/* ── TODAY ── */}
      <Card style={{ padding: '16px 20px' }}>
        <SectionLabel right={<span style={{ fontSize: 10.5, color: C.textFaint, fontWeight: 600 }}>last 24 hours</span>}>
          Today
        </SectionLabel>
        {firstLoad ? <LoadingRow n={5} /> : (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Metric label="New users" value={today?.new_users} color={C.purple} />
            <Metric label="Posts" value={today?.posts} color={C.amber} />
            <Metric label="Stories" value={today?.stories} color={C.pink} />
            <Metric label="Comments" value={today?.comments} color={C.teal} />
            <Metric label="Events" value={today?.events} color={C.accentHi} />
          </div>
        )}
        {totals && (
          <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', marginTop: 14, paddingTop: 12, borderTop: `1px solid ${C.border}`, fontSize: 11.5, color: C.textFaint }}>
            <span style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6 }}>All time</span>
            <span><strong style={{ color: C.text }}>{num(totals.users)}</strong> users</span>
            <span><strong style={{ color: C.text }}>{num(totals.places)}</strong> places</span>
            <span><strong style={{ color: C.text }}>{num(totals.groups)}</strong> groups</span>
          </div>
        )}
      </Card>

      {/* ── Trend + geography ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 16, alignItems: 'start' }}>
        <SignupsChart signups={d?.signups} loading={firstLoad} />
        <CountryBars countries={d?.countries} loading={firstLoad} />
      </div>

      {/* ── Health ── */}
      <HealthStrip
        health={health.data}
        loading={health.loading || identity.resolving}
        error={health.error}
        denied={!canSeeHealth || health.forbidden}
        role={gate.role}
      />

      {/* ── What this screen deliberately does not show ── */}
      <Note icon="🔒" tone={C.accent}>
        Everything on this screen is an aggregate. It counts posts and messages; it never shows who sent them,
        and it never shows message content. Countries are totals per country code, not per-person locations.
        If you need to act on a specific account, do it from the Users or Reports queue, where the action is
        recorded in the audit log with your name against it.
      </Note>
    </div>
  );
}

const LoadingRow = ({ n }) => (
  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
    {Array.from({ length: n }).map((_, i) => (
      <div key={i} style={{ flex: '1 1 120px', minWidth: 108 }}><SkeletonLine height={68} /></div>
    ))}
  </div>
);

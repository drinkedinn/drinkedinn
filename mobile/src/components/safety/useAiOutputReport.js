// src/components/safety/useAiOutputReport.js
// Flagging something the Innkeeper said.
//
// Google Play's generative-AI policy requires an in-app way to report
// problematic AI output, reachable from the output itself. This is the whole
// mechanism in one call: long-press an assistant bubble, pick a reason, done.
//
//   const { reportAiOutput } = useAiOutputReport();
//   <Pressable onLongPress={() => reportAiOutput(message)}>…</Pressable>
//
// `message` may be the chat message object ({ id, role, content }) or the reply
// text on its own. The reply has no row on the server, so the text travels with
// the report — a moderator cannot judge a reply they cannot read — and the
// target id is hashed from the reply so a second report of the same bubble
// collapses onto the first instead of filling the queue.

import { useCallback, useRef, useState } from 'react';
import api from '../../api';
import { useToast } from '../ui';
import { showReportSheet } from '../../lib/reportSheet';
import track from '../../lib/track';
import { AI_REASONS, excerpt, isChildSafetyReason, stableTargetId } from './reportCatalog';

export default function useAiOutputReport() {
  const toast = useToast();
  const [reporting, setReporting] = useState(false);
  const busy = useRef(false);

  const reportAiOutput = useCallback(
    async (message, { prompt } = {}) => {
      const content = typeof message === 'string' ? message : message?.content;
      const text = typeof content === 'string' ? content.trim() : '';
      if (!text || busy.current) return null;

      // Only the Innkeeper's own words are reportable here — a member's message
      // is their content, and it is not moderated through the AI path.
      if (message && typeof message === 'object' && message.role && message.role !== 'assistant') {
        return null;
      }

      // The sheet is a singleton: a second long-press while it is open would
      // orphan the first call's promise, so the guard covers the picker too.
      busy.current = true;
      try {
        const reason = await showReportSheet({
          title: 'What’s wrong with this reply?',
          reasons: AI_REASONS,
        });
        if (!reason) return null;

        setReporting(true);
        const quoted = excerpt(text);
        const asked = prompt ? ` | asked: ${excerpt(prompt, 90)}` : '';
        await api.post('/reports', {
          target_type: 'ai_output',
          target_id: stableTargetId(
            message && typeof message === 'object' && message.id ? `${message.id}|${text}` : text
          ),
          reason: `${reason}: ${quoted}${asked}`,
        });
        track('ai_output_reported', { reason });
        toast?.show(
          isChildSafetyReason(reason)
            ? 'Sent to the safety team.'
            : 'Thanks — the safety team will review that reply.',
          'success'
        );
        return reason;
      } catch (e) {
        toast?.show(e?.safeMessage || 'Could not send that report.', 'error');
        return null;
      } finally {
        busy.current = false;
        setReporting(false);
      }
    },
    [toast]
  );

  return { reportAiOutput, reporting };
}

// src/screens/safety/useReportRouter.js
// "Report something" — the picker behind the Safety Center's first row.
//
// A report always belongs to a thing: a moment, a person, a message, a reply.
// Rather than asking somebody to describe that thing in a box, this asks what
// kind of thing it is and puts them in front of it, where the options menu
// already files a proper report against a real id. The one exception is a
// child-safety concern, which has its own form and needs no target at all.
//
// The picker is showReportSheet, never Alert — Android silently drops
// everything past the third button, and there are seven options here.

import { useCallback } from 'react';
import { showReportSheet } from '../../lib/reportSheet';
import { useToast } from '../../components/ui';
import track from '../../lib/track';
import { openSafetyMail } from '../../components/safety/safetyLinks';
import { SAFETY_EMAIL_HINT } from '../../components/safety/reportCatalog';

const WHAT = [
  { key: 'moment', label: 'A moment, story or photo' },
  { key: 'person', label: 'Someone’s profile or behaviour' },
  { key: 'message', label: 'A direct message' },
  { key: 'place_group', label: 'A group, event or place' },
  { key: 'ai', label: 'Something the Innkeeper said' },
  { key: 'child_safety', label: 'A child-safety concern' },
  { key: 'other', label: 'Something else' },
];

export default function useReportRouter(navigation) {
  const toast = useToast();

  const openReportPicker = useCallback(async () => {
    const choice = await showReportSheet({
      title: 'What would you like to report?',
      reasons: WHAT,
    });
    if (!choice) return null;
    track('safety_report_router', { choice });

    const hint = (msg) => toast?.show(msg, 'info');

    try {
      switch (choice) {
        case 'moment':
          hint('Open the moment, then tap its options button to report it.');
          navigation.navigate('Tabs', { screen: 'Home' });
          break;
        case 'person':
          hint('Find the person, open their profile, then tap the options button.');
          navigation.navigate('Tabs', { screen: 'Discover' });
          break;
        case 'message':
          hint('Open the conversation, then tap the options button.');
          navigation.navigate('Conversations');
          break;
        case 'place_group':
          hint('Open the group or event, then tap its options button.');
          navigation.navigate('Groups');
          break;
        case 'ai':
          hint('Press and hold the Innkeeper’s reply to report it.');
          navigation.navigate('AskInnkeeper');
          break;
        case 'child_safety':
          navigation.navigate('ChildSafetyReport');
          break;
        case 'other':
        default:
          if (!(await openSafetyMail('Report'))) {
            toast?.show(SAFETY_EMAIL_HINT, 'error');
          }
          break;
      }
    } catch {
      // A route that isn't registered yet should not strand the member.
      toast?.show(SAFETY_EMAIL_HINT, 'error');
    }
    return choice;
  }, [navigation, toast]);

  return { openReportPicker };
}

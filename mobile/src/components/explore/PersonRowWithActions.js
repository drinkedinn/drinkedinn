// src/components/explore/PersonRowWithActions.js
// The existing PersonRow (unchanged behaviour — optimistic connect, tap to
// open the profile) with the report/block control it needs in order to be
// shown on its own.
//
// PersonRow is shared with other screens, so it is wrapped rather than
// modified: it keeps its 16pt left gutter and flexes, and the options button
// sits in the gutter on the right.

import React, { memo } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { Icon } from '../ui';
import PersonRow from '../discover/PersonRow';

function PersonRowWithActions({ person, onOpen, onChanged, onOptions, isSelf }) {
  const { t } = useTheme();
  if (!person) return null;

  return (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <PersonRow person={person} onOpen={onOpen} onChanged={onChanged} />
      </View>
      {!isSelf && (
        <Pressable
          onPress={() => onOptions?.(person)}
          hitSlop={10}
          style={styles.options}
          accessibilityRole="button"
          accessibilityLabel={`Options for ${person.name || 'this member'}`}
        >
          <Icon name="ellipsis-horizontal" size={18} color={t.textMuted} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  // paddingRight is the screen gutter: it puts the glyph's right edge 16pt
  // from the edge, in line with every other row on the screen, while the tall
  // vertical padding keeps the touch target comfortably above 44pt.
  options: { paddingLeft: 6, paddingRight: 16, paddingVertical: 16 },
});

export default memo(PersonRowWithActions);

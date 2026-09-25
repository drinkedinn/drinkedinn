// src/components/sommelier/RichText.js
// A tiny, deliberately-strict renderer for the Innkeeper's replies.
//
// The model returns plain text with two conventions we honour visually:
//   • **bold** for emphasis (bottle names, region names, the pairing verdict)
//   • \n for line breaks (paragraphs, short lists)
//
// Everything else — HTML, JSX, backticks, images — is rendered verbatim as
// text. There is no dangerouslySetInnerHTML, no regex-driven attribute parsing,
// no untrusted URL following. The nesting relies only on React Native's own
// <Text> composition, which handles wrapping and selection correctly.

import React from 'react';
import { Text } from 'react-native';

function segmentsForLine(line) {
  // Split on the literal token **. Odd-indexed slices are bold. An unmatched
  // trailing ** collapses harmlessly — the tail simply renders un-bold.
  const parts = line.split('**');
  const segs = [];
  parts.forEach((p, i) => {
    if (p.length === 0) return;
    segs.push({ text: p, bold: i % 2 === 1 });
  });
  return segs;
}

export default function RichText({ text, style, boldStyle }) {
  if (typeof text !== 'string' || text.length === 0) return null;

  const lines = text.split('\n');
  return (
    <Text style={style} selectable>
      {lines.map((line, li) => {
        const segs = segmentsForLine(line);
        return (
          <Text key={li}>
            {li > 0 ? '\n' : null}
            {segs.length === 0 ? '' : segs.map((s, i) =>
              s.bold ? (
                <Text key={i} style={boldStyle || { fontWeight: '700' }}>{s.text}</Text>
              ) : (
                <Text key={i}>{s.text}</Text>
              )
            )}
          </Text>
        );
      })}
    </Text>
  );
}

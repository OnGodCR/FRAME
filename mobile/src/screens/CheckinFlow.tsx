import React, { useState } from 'react';
import { CaptureSequence } from '../components/CaptureSequence';
import { useGame } from '../engine/GameContext';

// The in-round check-in. The capture, validation, and submitted states all
// live in CaptureSequence so that practice and the daily assignment rehearse
// this exact sequence. What is specific to a real round is only the deadline,
// the stakes, and where the photos go.

export function CheckinFlow() {
  const { round, submitCheckin, go } = useGame();
  // Captured at mount: round.checkin is cleared the moment the submission
  // registers, but the confirmation screen still needs the index.
  const [ciIndex] = useState(round?.checkin?.index ?? 0);

  if (!round) return null;
  const remaining = round.checkin ? round.checkin.deadline - round.elapsed : 0;

  return (
    <CaptureSequence
      eyebrow={`Check-in 0${ciIndex}`}
      remaining={remaining}
      onValidated={submitCheckin}
      doneTitle="In the seeker's feed now."
      doneNote="ENCRYPTED AT REST · AUTO-DELETED 24 H AFTER ROUND END · NEVER IN MATCH HISTORY"
      doneCta="Return to hiding"
      onDone={() => go('round')}
    />
  );
}

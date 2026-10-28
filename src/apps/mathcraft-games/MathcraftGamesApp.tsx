import { useEffect, useRef, useState } from 'react';

import { SetupView } from './components/SetupView';
import { AnswerEntry, type AnswerEntryHandle } from './components/AnswerEntry';
import { DefeatOverlay } from './components/DefeatOverlay';
import { EndSessionConfirm } from './components/EndSessionConfirm';
import { GameView } from './components/GameView';
import { PauseOverlay } from './components/PauseOverlay';
import { ProblemWorkDisplay } from './components/ProblemWorkDisplay';
import { SummaryView } from './components/SummaryView';

import type { SessionOptions, SessionSetup } from './session/session';

import { useMathcraftSession, type UseMathcraftSessionResult } from './hooks/useMathcraftSession';

interface MathcraftGamesAppProps {
  // Optional session options (injectable time source / random) for deterministic tests.
  sessionOptions?: SessionOptions;
  // Observability seam: reports the full hook result after each render (used by tests).
  onResult?: (result: UseMathcraftSessionResult) => void;
}

export function MathcraftGamesApp({ sessionOptions, onResult }: MathcraftGamesAppProps = {}) {

  const [setup, setSetup] = useState<SessionSetup | null>(null);

  if (setup === null) {
    return <SetupView onStart={setSetup} />;
  }

  return <ActiveExperience setup={setup} sessionOptions={sessionOptions} onResult={onResult} />;
}

function ActiveExperience({ setup, sessionOptions, onResult, }: {
  setup: SessionSetup;
  sessionOptions?: SessionOptions;
  onResult?: (result: UseMathcraftSessionResult) => void;
}) {
  const result = useMathcraftSession(setup, sessionOptions);

  const {
    snapshot,
    start,
    submitAnswer,
    advance,
    pause,
    resume,
    respawn,
    equip,
    endSession,
    noteKeyInput,
    markCombatPresentationComplete,
  } = result;

  // Observability seam for tests: report the full hook result after each render.
  useEffect(() => {
    onResult?.(result);
  }, [result, onResult]);

  const entryRef = useRef<AnswerEntryHandle>(null);
  
  const [isEndSessionConfirmOpen, setIsEndSessionConfirmOpen] = useState(false);

  // Whether the answer entry currently accepts input (false during the
  // wrong-answer feedback interval or when externally disabled).
  const [accepting, setAccepting] = useState(true);

  // Start the session once the experience is mounted.
  useEffect(() => {
    start();
  }, [start]);

  // Physical-keyboard listener (MGP6-06): digits append, Backspace deletes,
  // Enter submits or advances, matching the keypad action. Every handled keypress resets the idle timer via
  // noteKeyInput. Handling is skipped entirely while entry is not accepting
  // (wrong-answer interval, paused, or no active problem).
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!accepting || isEndSessionConfirmOpen) {
        return;
      }
      if (/^[0-9]$/.test(event.key)) {
        noteKeyInput();
        entryRef.current?.appendDigit(event.key);
      } else if (event.key === 'Backspace') {
        noteKeyInput();
        entryRef.current?.deleteDigit();
      } else if (event.key === 'Enter') {
        noteKeyInput();
        entryRef.current?.activateEnter();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [accepting, isEndSessionConfirmOpen, noteKeyInput]);

  // Signal the coordinator once the active problem's combat outcome has been
  // shown (i.e. the lifecycle transitions to solved), which enables Next.
  const solvedRef = useRef(false);
  useEffect(() => {
    const solved = snapshot.activeLifecycleState?.snapshot.stepIndex === null;
    if (solved && !solvedRef.current) {
      markCombatPresentationComplete();
    }
    solvedRef.current = solved;
  }, [snapshot.activeLifecycleState, markCombatPresentationComplete]);

  const state = snapshot.state;

  // Before start() runs (first paint) there is nothing meaningful to show.
  if (state.kind === 'setup') {
    return null;
  }

  if (state.kind === 'summary') {
    return <SummaryView summary={snapshot.summary} />;
  }

  const inPlay = state.kind === 'active' || state.kind === 'boss-fight';

  const gameView = (
    <GameView
      gameState={snapshot.gameState}
      onEquip={equip}
    />
  );
  const problemWork = snapshot.activeLifecycleState !== null
    ? <ProblemWorkDisplay lifecycle={snapshot.activeLifecycleState} />
    : null;

  return (
    <div className="mx-auto flex min-h-[calc(100svh-2.75rem)] w-full max-w-7xl flex-col gap-4 p-4">
      {inPlay && (
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={pause}
            className="rounded-lg border border-panel-border bg-panel px-4 py-1.5 text-sm text-neutral-300 hover:bg-panel/70"
          >
            Pause
          </button>
          <button
            type="button"
            onClick={() => setIsEndSessionConfirmOpen(true)}
            className="rounded-lg border border-panel-border bg-panel px-4 py-1.5 text-sm text-red-400 hover:bg-panel/70"
          >
            End Session
          </button>
        </div>
      )}

      {inPlay ? (
        <div className="my-auto grid min-w-0 grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1.8fr)_minmax(13rem,0.95fr)_minmax(11rem,0.75fr)]">
          {gameView}
          {problemWork}
          <AnswerEntry
            ref={entryRef}
            disabled={snapshot.activeLifecycleState === null || isEndSessionConfirmOpen}
            nextEnabled={snapshot.combatPresentationComplete}
            onSubmit={submitAnswer}
            onNext={advance}
            onAcceptingChange={setAccepting}
          />
        </div>
      ) : (
        <>
          {problemWork}
          {gameView}
        </>
      )}

      {state.kind === 'manual-paused' && (
        <PauseOverlay kind="manual" offersEndSession={false} onResume={resume} onEndSession={endSession} />
      )}
      {state.kind === 'idle-paused' && (
        <PauseOverlay
          kind="idle"
          offersEndSession={snapshot.idleOffersEndSession}
          onResume={resume}
          onEndSession={endSession}
        />
      )}
      {state.kind === 'defeat' && <DefeatOverlay onRespawn={respawn} onEndSession={endSession} />}
      {inPlay && isEndSessionConfirmOpen && (
        <EndSessionConfirm
          onCancel={() => setIsEndSessionConfirmOpen(false)}
          onConfirm={() => {
            setIsEndSessionConfirmOpen(false);
            endSession();
          }}
        />
      )}
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import type { Scenario, ScenarioStep } from '../copy';
import { useLang } from './LanguageContext';

/* Shared playback engine for every "live scenario" on the site (Scenarios,
   Coordinator). Generalized from the hero ChatCard: steps appear on timers,
   tapping the stage skips ahead, and the one rule that makes it honest:
   playback STOPS at a confirmation card until the VISITOR presses Confirm.
   The visitor physically enacts "nothing writes without your click".

   Reduced motion: everything up to the confirm card renders at once; the
   confirm pause stays interactive (it is input, not motion). */

type Phase = 'idle' | 'playing' | 'paused' | 'done';

function stepDelay(step: ScenarioStep): number {
  if (step.kind === 'typing') return 900;
  if (step.kind === 'frame') return 1200;
  return 700;
}

/* Index of the step a confirm pause sits at, if any. */
function isPause(step: ScenarioStep | undefined): boolean {
  return !!step && (step.kind === 'confirm' || step.kind === 'diff');
}

export function ScenarioPlayer({
  scenario,
  autoPlay = false,
  onReset,
}: {
  scenario: Scenario;
  autoPlay?: boolean;
  onReset?: () => void;
}) {
  const { t } = useLang();
  const s = t.scenarios;
  const [phase, setPhase] = useState<Phase>('idle');
  const [shown, setShown] = useState(0); /* steps visible (0..steps.length) */
  const timer = useRef(0);
  const stageRef = useRef<HTMLDivElement>(null);

  const steps = scenario.steps;
  const reduced =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const clear = () => window.clearTimeout(timer.current);

  /* Advance to the next visible step; pause on confirm/diff cards. */
  const scheduleFrom = (index: number, instant: boolean) => {
    clear();
    if (index >= steps.length) {
      setPhase('done');
      return;
    }
    const reveal = () => {
      setShown(index + 1);
      if (isPause(steps[index])) {
        setPhase('paused');
      } else {
        scheduleFrom(index + 1, instant);
      }
    };
    if (instant) {
      /* Reduced motion: pour everything out to the next pause synchronously. */
      let i = index;
      while (i < steps.length && !isPause(steps[i])) i += 1;
      if (i < steps.length) {
        setShown(i + 1);
        setPhase('paused');
      } else {
        setShown(steps.length);
        setPhase('done');
      }
      return;
    }
    timer.current = window.setTimeout(reveal, stepDelay(steps[index]));
  };

  const play = () => {
    setShown(0);
    setPhase('playing');
    scheduleFrom(0, reduced);
  };

  const skip = () => {
    if (phase !== 'playing') return;
    clear();
    scheduleFrom(shown, true);
  };

  const confirm = () => {
    if (phase !== 'paused') return;
    setPhase('playing');
    scheduleFrom(shown, reduced);
  };

  const cancel = () => {
    clear();
    setShown(0);
    setPhase('idle');
    onReset?.();
  };

  useEffect(() => {
    if (autoPlay) play();
    return clear;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenario.id]);

  useEffect(() => {
    const el = stageRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [shown, phase]);

  const confirmedIdx = useRef<Set<number>>(new Set());
  useEffect(() => {
    confirmedIdx.current = new Set();
  }, [scenario.id]);

  if (phase === 'idle') {
    return (
      <div className="scn-poster">
        <span className="badge">
          <span className="badge__dot" aria-hidden="true" />
          {scenario.timeLabel}
        </span>
        <p className="scn-poster__hook">{scenario.hook}</p>
        <button type="button" className="scn-play" onClick={play} aria-label={`${s.playAria}: ${scenario.label}`}>
          <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true">
            <path d="M8 5.5v13l11-6.5z" />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <div className="scn-stage-wrap">
      <div
        ref={stageRef}
        className="scn-stage"
        aria-live="polite"
        onClick={skip}
        role={phase === 'playing' ? 'button' : undefined}
        tabIndex={phase === 'playing' ? 0 : undefined}
        onKeyDown={(e) => {
          if (phase === 'playing' && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            skip();
          }
        }}
      >
        {phase === 'playing' && <span className="visually-hidden">{s.tapSkip}</span>}
        {steps.slice(0, shown).map((step, i) => {
          const isCurrentPause = isPause(step) && i === shown - 1 && phase === 'paused';
          const wasConfirmed = isPause(step) && (i < shown - 1 || phase === 'done' || (phase === 'playing' && i <= shown - 1));
          return (
            <StepView
              key={i}
              step={step}
              pausedHere={isCurrentPause}
              confirmed={!isCurrentPause && wasConfirmed}
              onConfirm={confirm}
              onCancel={cancel}
            />
          );
        })}
        {phase === 'playing' && shown < steps.length && steps[shown]?.kind === 'typing' && (
          <p className="bubble bubble--ai bubble--typing" aria-hidden="true">
            <span />
            <span />
            <span />
          </p>
        )}
      </div>

      {phase === 'done' && (
        <div className="scn-end">
          <p className="scn-end__note">
            <span className="scn-end__tick" aria-hidden="true">
              ✓
            </span>
            {scenario.endNote}
          </p>
          <div className="scn-end__row">
            <button type="button" className="btn btn--ghost scn-end__replay" onClick={play}>
              {s.replay}
            </button>
            {scenario.caption && (
              <a className="scn-end__link" href={scenario.caption.href}>
                {scenario.caption.text}
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function StepView({
  step,
  pausedHere,
  confirmed,
  onConfirm,
  onCancel,
}: {
  step: ScenarioStep;
  pausedHere: boolean;
  confirmed: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (step.kind === 'typing') return null;

  if (step.kind === 'guest') return <p className="bubble bubble--guest">{step.text}</p>;
  if (step.kind === 'ai') return <p className="bubble bubble--ai">{step.text}</p>;
  if (step.kind === 'couple')
    return (
      <p className="bubble bubble--guest bubble--couple">
        <span className="bubble__who">You</span>
        {step.text}
      </p>
    );
  if (step.kind === 'note') return <p className="scn-note">{step.text}</p>;

  if (step.kind === 'frame' && step.frame)
    return (
      <div className="scn-frame">
        <span className="scn-frame__title">{step.frame.title}</span>
        {step.frame.rows.map((row, i) => (
          <span key={i} className="scn-frame__row">
            {row}
          </span>
        ))}
      </div>
    );

  if ((step.kind === 'confirm' || step.kind === 'diff') && step.card) {
    const card = step.card;
    return (
      <div className={step.kind === 'diff' ? 'confirm-card confirm-card--diff' : 'confirm-card'}>
        <span className="confirm-card__title">{card.title}</span>
        <ul className="confirm-card__lines">
          {card.lines.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
        {pausedHere ? (
          <div className="confirm-card__actions">
            <button type="button" className="btn btn--ghost confirm-card__cancel" onClick={onCancel}>
              {card.cancel}
            </button>
            <button type="button" className="btn btn--gold confirm-card__confirm" onClick={onConfirm}>
              {card.confirm}
            </button>
          </div>
        ) : confirmed ? (
          <p className="confirm-card__done">
            <span aria-hidden="true">✓</span>
            {card.done}
          </p>
        ) : null}
      </div>
    );
  }

  return null;
}

import { useEffect, useState } from 'react';
import { useLang } from './LanguageContext';

interface VisibleMsg {
  key: number;
  from: 'guest' | 'ai';
  text: string;
}

/* Looping chat mock for the hero: guest bubble → typing dots → AI reply,
   next pair, hold, fade, restart. State-driven so the DOM never accumulates
   nodes — at most one full conversation is mounted at a time. */
export function ChatCard() {
  const { t } = useLang();
  const chat = t.hero.chat;

  const [visible, setVisible] = useState<VisibleMsg[]>([]);
  const [typing, setTyping] = useState(false);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const messages = chat.messages;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (reduced) {
      /* No loop: show the whole conversation statically. */
      setVisible(messages.map((m, i) => ({ key: i, from: m.from, text: m.text })));
      setTyping(false);
      setFading(false);
      return;
    }

    let cancelled = false;
    let timer = 0;
    let key = 0;
    const schedule = (fn: () => void, ms: number) => {
      if (cancelled) return;
      timer = window.setTimeout(() => {
        if (!cancelled) fn();
      }, ms);
    };

    const playFrom = (i: number) => {
      if (i >= messages.length) {
        /* Hold the finished conversation, fade it out, restart. */
        schedule(() => {
          setFading(true);
          schedule(() => {
            setVisible([]);
            setFading(false);
            schedule(() => playFrom(0), 500);
          }, 700);
        }, 2500);
        return;
      }
      const m = messages[i];
      if (m.from === 'ai') {
        setTyping(true);
        schedule(() => {
          setTyping(false);
          setVisible((v) => [...v, { key: key++, from: m.from, text: m.text }]);
          schedule(() => playFrom(i + 1), 900);
        }, 1000);
      } else {
        setVisible((v) => [...v, { key: key++, from: m.from, text: m.text }]);
        schedule(() => playFrom(i + 1), 650);
      }
    };

    setVisible([]);
    setTyping(false);
    setFading(false);
    schedule(() => playFrom(0), 800);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [chat]);

  return (
    <div className="chat-card glass">
      <div className="chat-card__head">
        <span className="chat-card__mono" aria-hidden="true">
          G
        </span>
        <div className="chat-card__id">
          <span className="chat-card__name">{chat.header}</span>
          <span className="chat-card__status">
            <span className="chat-card__dot" aria-hidden="true" />
            {chat.sub}
          </span>
        </div>
      </div>

      <div className="chat-card__chips">
        {chat.chips.map((chip) => (
          <span key={chip} className="chat-chip">
            {chip}
          </span>
        ))}
      </div>

      <div className={fading ? 'chat-card__body is-fading' : 'chat-card__body'}>
        {visible.map((m) => (
          <p key={m.key} className={`bubble bubble--${m.from}`}>
            {m.text}
          </p>
        ))}
        {typing && (
          <p className="bubble bubble--ai bubble--typing" aria-hidden="true">
            <span />
            <span />
            <span />
          </p>
        )}
      </div>

      <div className="chat-card__input" aria-hidden="true">
        <span className="chat-card__placeholder">{chat.inputPlaceholder}</span>
        <span className="chat-card__send">→</span>
      </div>
    </div>
  );
}

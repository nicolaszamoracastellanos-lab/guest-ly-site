import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useLang } from './LanguageContext';
import { DEMO_LIMITS, LIVE_DEMO, SANDBOX_BOT_ENDPOINT } from '../config';

interface VisibleMsg {
  key: number;
  from: 'guest' | 'ai';
  text: string;
}

/* Hero chat card, two modes behind the LIVE_DEMO config flag:

   scripted (endpoint PENDING): the pre-wave-5 looping mock, guest bubble,
   typing dots, AI reply, hold, fade, restart.

   live: the first scripted question and answer autoplay for ambience, then
   the input is real. Typed messages and the quick-reply chips go to the
   sandbox concierge (a fictional demo wedding, never production). Client
   guardrails: max messages per session, max chars, min interval; session
   state lives in memory only. Errors degrade to a scripted answer. */
export function ChatCard() {
  const { t } = useLang();
  const chat = t.hero.chat;
  const live = LIVE_DEMO === 'live';

  const [visible, setVisible] = useState<VisibleMsg[]>([]);
  const [typing, setTyping] = useState(false);
  const [fading, setFading] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const keyRef = useRef(0);
  const sentCountRef = useRef(0);
  const lastSentRef = useRef(0);
  const bodyRef = useRef<HTMLDivElement>(null);

  const push = (from: 'guest' | 'ai', text: string) =>
    setVisible((v) => [...v, { key: keyRef.current++, from, text }]);

  /* Scripted loop (also the live mode's opening ambience). */
  useEffect(() => {
    const messages = live ? chat.messages.slice(0, 2) : chat.messages;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (reduced) {
      setVisible(messages.map((m, i) => ({ key: i, from: m.from, text: m.text })));
      keyRef.current = messages.length;
      setTyping(false);
      setFading(false);
      return;
    }

    let cancelled = false;
    let timer = 0;
    const schedule = (fn: () => void, ms: number) => {
      if (cancelled) return;
      timer = window.setTimeout(() => {
        if (!cancelled) fn();
      }, ms);
    };

    const playFrom = (i: number) => {
      if (i >= messages.length) {
        if (live) return; /* live mode: stop after the opener, invite typing */
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
          push(m.from, m.text);
          schedule(() => playFrom(i + 1), 900);
        }, 1000);
      } else {
        push(m.from, m.text);
        schedule(() => playFrom(i + 1), 650);
      }
    };

    setVisible([]);
    keyRef.current = 0;
    setTyping(false);
    setFading(false);
    schedule(() => playFrom(0), 800);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [chat, live]);

  /* Keep the newest bubble in view in live mode. */
  useEffect(() => {
    const el = bodyRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [visible, typing]);

  const send = async (raw: string) => {
    const text = raw.trim().slice(0, DEMO_LIMITS.maxChars);
    if (!live || !text || typing) return;
    const now = Date.now();
    if (sentCountRef.current >= DEMO_LIMITS.maxMessages) {
      setNote(chat.limitNote);
      return;
    }
    if (now - lastSentRef.current < DEMO_LIMITS.minIntervalMs) {
      setNote(chat.rateNote);
      return;
    }
    setNote(null);
    lastSentRef.current = now;
    sentCountRef.current += 1;
    setInput('');
    push('guest', text);
    setTyping(true);
    try {
      const res = await fetch(SANDBOX_BOT_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      });
      if (!res.ok) throw new Error(`demo endpoint ${res.status}`);
      const data = (await res.json()) as { reply?: string };
      if (!data.reply) throw new Error('empty reply');
      setTyping(false);
      push('ai', data.reply);
    } catch {
      /* Graceful degradation: never a broken card. */
      setTyping(false);
      const fallback = chat.messages.find((m) => m.from === 'ai');
      push('ai', `${chat.errorPrefix} ${fallback ? fallback.text : ''}`.trim());
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void send(input);
  };

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
        {chat.chips.map((chip) =>
          live ? (
            <button key={chip} type="button" className="chat-chip chat-chip--btn" onClick={() => void send(chip)}>
              {chip}
            </button>
          ) : (
            <span key={chip} className="chat-chip">
              {chip}
            </span>
          ),
        )}
      </div>

      <div ref={bodyRef} className={fading ? 'chat-card__body is-fading' : 'chat-card__body'}>
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

      {note && <p className="chat-card__note">{note}</p>}

      {live ? (
        <>
          <form className="chat-card__input chat-card__input--live" onSubmit={onSubmit}>
            <input
              type="text"
              value={input}
              maxLength={DEMO_LIMITS.maxChars}
              placeholder={chat.inputPlaceholderLive}
              aria-label={chat.inputPlaceholderLive}
              onChange={(e) => setInput(e.target.value)}
            />
            <button type="submit" className="chat-card__send" aria-label={chat.send}>
              →
            </button>
          </form>
          <p className="chat-card__live-tag">{chat.liveTag}</p>
        </>
      ) : (
        <div className="chat-card__input" aria-hidden="true">
          <span className="chat-card__placeholder">{chat.inputPlaceholder}</span>
          <span className="chat-card__send">→</span>
        </div>
      )}
    </div>
  );
}

// D5 mic in the Coordinator composer: record with expo-audio, send the file to
// the portal's voice path, wait for the text, put it in the message box. Dark
// until the wedding's MW_MIC is on and the voice route answers enabled (the
// AssemblyAI key is not there yet). Before the first recording the 5.1.2(i)
// consent sheet names AssemblyAI (and Anthropic for the chat itself).
//
// Nothing records until the person taps the mic; there is no background audio
// (app.config.ts expo-audio plugin: background recording off). The local file
// is deleted as soon as it is sent or cancelled.

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Linking, Pressable, StyleSheet, View, ActivityIndicator } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from "expo-audio";
import { File } from "expo-file-system";
import * as Haptics from "expo-haptics";
import { fmt } from "@/i18n";
import { useFeatureCopy } from "@/i18n/feature";
import { ApiFailure, del, get, isMissingEndpoint, post } from "@/lib/api";
import { featureOn, useUserSession } from "@/lib/session";
import { ChatComposer, Icon, Row, T, toast, toastError } from "@/ui";
import type { ComposerProps } from "@/ui";
import { colors, HIT_TARGET } from "@/ui/tokens";
import { VOICE_COPY } from "./voiceCopy";
import { VOICE_MAX_BYTES, clockOf, micVisible, pollDelay, pollGivesUp, readAvailability, readPoll, readStart, recordingName, voiceFailure, type VoiceAvailability, type VoiceFailure } from "./voiceCore";

type Phase = "idle" | "starting" | "recording" | "sending";

/** Whether the mic is drawn for this chat: flag, route and role (voiceCore.micVisible). */
export function useMicAvailable(base: string, canSend: boolean): VoiceAvailability | null {
  const me = useUserSession()?.me;
  const flag = featureOn(me, "MW_MIC");
  const q = useQuery({
    queryKey: ["assistant-voice", base, me?.tenant.slug ?? null],
    queryFn: async () => {
      try {
        return readAvailability(await get<unknown>(`${base}/voice`));
      } catch (err) {
        // A portal without the route, or MW_MIC off: no mic, quietly.
        if (isMissingEndpoint(err)) return { enabled: false, maxSeconds: 0 };
        throw err;
      }
    },
    enabled: flag && canSend,
    staleTime: 5 * 60_000,
    retry: false,
  });
  const a = q.data ?? null;
  return micVisible(flag, a, canSend) ? a : null;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * The recorder and the trip to the server. `onText` gets the transcript and
 * the server's receipt; the parent merges it into the draft.
 */
export function useVoiceNote(opts: { base: string; lang: "en" | "es"; maxSeconds: number; onText: (text: string, receipt: string) => void; ask: () => Promise<boolean> }) {
  const c = useFeatureCopy(VOICE_COPY);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const rec = useAudioRecorderState(recorder, 250);
  const [phase, setPhase] = useState<Phase>("idle");
  const phaseRef = useRef<Phase>("idle");
  const cancelled = useRef(false);
  const set = (p: Phase) => {
    phaseRef.current = p;
    setPhase(p);
  };
  const minutes = Math.round(opts.maxSeconds / 60);

  const fail = useCallback(
    (kind: VoiceFailure) => {
      const text = fmt(c.fail[kind], { min: minutes });
      if (kind === "denied") toast(text, { icon: "warning", ms: 8000, undo: () => void Linking.openSettings().catch(() => {}), undoLabel: c.openSettings });
      else toastError(text);
    },
    [c, minutes]
  );

  const release = async () => {
    await setAudioModeAsync({ allowsRecording: false }).catch(() => {});
  };

  const start = async () => {
    if (phaseRef.current !== "idle") return;
    set("starting");
    // 5.1.2(i): Anthropic (the chat) and AssemblyAI (the recording), before anything records.
    if (!(await opts.ask())) return set("idle");
    const perm = await requestRecordingPermissionsAsync().catch(() => null);
    if (!perm?.granted) {
      set("idle");
      return fail("denied");
    }
    try {
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      cancelled.current = false;
      recorder.record({ forDuration: opts.maxSeconds });
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      set("recording");
    } catch {
      await release();
      set("idle");
      fail("failed");
    }
  };

  const discardFile = (uri: string | null) => {
    if (!uri) return;
    try {
      new File(uri).delete();
    } catch {
      // the system clears its cache folder; a leftover is harmless
    }
  };

  const cancel = async () => {
    if (phaseRef.current !== "recording" && phaseRef.current !== "sending") return;
    cancelled.current = true;
    if (phaseRef.current === "recording") {
      await recorder.stop().catch(() => {});
      discardFile(recorder.uri);
      await release();
      set("idle");
    }
    // While sending, the loop sees `cancelled`, deletes the note and stops.
  };

  const send = async () => {
    if (phaseRef.current !== "recording") return;
    set("sending");
    await recorder.stop().catch(() => {});
    await release();
    const uri = recorder.uri;
    let noteId: string | null = null;
    try {
      const file = uri ? new File(uri) : null;
      if (!file || !file.exists || !file.size) throw new ApiFailure(400, { code: "empty", message_en: "", message_es: "" });
      if (file.size > VOICE_MAX_BYTES) throw new ApiFailure(413, { code: "too_large", message_en: "", message_es: "" });
      const started = readStart(await post<unknown>(`${opts.base}/voice`, { filename: recordingName(uri), size: file.size }));
      if (!started) throw new ApiFailure(502, null);
      noteId = started.noteId;
      if (started.uploadUrl) {
        const put = await file.upload(started.uploadUrl, { httpMethod: "PUT", headers: { "Content-Type": started.contentType, "x-upsert": "true" }, mimeType: started.contentType, sessionType: "foreground" });
        if (put.status < 200 || put.status >= 300) throw new ApiFailure(put.status || 0, null);
      }
      discardFile(uri);
      if (cancelled.current) throw new Error("cancelled");
      await post(`${opts.base}/voice/${encodeURIComponent(noteId)}/transcribe`, { lang: opts.lang });
      const startedAt = Date.now();
      for (let attempt = 0; ; attempt++) {
        await sleep(pollDelay(attempt));
        if (cancelled.current) throw new Error("cancelled");
        if (pollGivesUp(startedAt, Date.now())) throw new ApiFailure(408, { code: "timeout", message_en: "", message_es: "" });
        const polled = readPoll(await get<unknown>(`${opts.base}/voice/${encodeURIComponent(noteId)}?lang=${opts.lang}`));
        if (!polled) throw new ApiFailure(502, null);
        if (polled.status === "completed") {
          noteId = null; // read: the server deleted both copies
          opts.onText(polled.text, polled.receipt);
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          break;
        }
      }
    } catch (err) {
      discardFile(uri);
      if (noteId) void del(`${opts.base}/voice/${encodeURIComponent(noteId)}`).catch(() => {});
      if (!cancelled.current) fail(err instanceof ApiFailure ? (err.code === "empty" ? "empty" : voiceFailure(err.status, err.code)) : "failed");
    } finally {
      set("idle");
    }
  };

  // The recorder stops by itself at the limit: send what was said.
  const wasRecording = useRef(false);
  useEffect(() => {
    if (wasRecording.current && !rec.isRecording && phaseRef.current === "recording" && !cancelled.current) void send();
    wasRecording.current = rec.isRecording;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rec.isRecording]);

  return { phase, durationMs: rec.durationMillis ?? 0, start, stop: send, cancel };
}

/** The mic beside the message box. */
export function MicButton({ onPress, busy, disabled }: { onPress: () => void; busy: boolean; disabled?: boolean }) {
  const c = useFeatureCopy(VOICE_COPY);
  return (
    <Pressable
      testID="assistant-mic"
      accessibilityRole="button"
      accessibilityLabel={c.mic}
      accessibilityState={{ disabled: !!disabled, busy }}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [styles.mic, pressed && { opacity: 0.8 }, disabled && { opacity: 0.4 }]}
    >
      {busy ? <ActivityIndicator size="small" color={colors.ivory70} /> : <Icon name="mic" size={22} color={colors.ivory70} />}
    </Pressable>
  );
}

/** Replaces the message box while recording or turning the note into text. */
export function RecordingBar({ phase, durationMs, maxSeconds, onStop, onCancel }: { phase: Phase; durationMs: number; maxSeconds: number; onStop: () => void; onCancel: () => void }) {
  const c = useFeatureCopy(VOICE_COPY);
  const sending = phase === "sending";
  return (
    <View style={styles.bar} testID="assistant-recording">
      <Pressable accessibilityRole="button" accessibilityLabel={c.cancel} onPress={onCancel} style={styles.side} hitSlop={6}>
        <Icon name="x" size={20} color={colors.ivory70} />
      </Pressable>
      <Row gap={10} style={{ flex: 1 }}>
        {sending ? <ActivityIndicator size="small" color={colors.ivory70} /> : <Icon name="mic" size={18} color={colors.red} />}
        <View style={{ flex: 1 }} accessibilityLiveRegion="polite">
          <T v="body15" color={colors.ivory} style={styles.tnum}>
            {sending ? c.transcribing : fmt(c.recording, { time: clockOf(durationMs) })}
          </T>
          {sending ? null : (
            <T v="meta13" color={colors.ivory55} style={styles.tnum}>
              {fmt(c.limit, { min: Math.round(maxSeconds / 60) })}
            </T>
          )}
        </View>
      </Row>
      <Pressable accessibilityRole="button" accessibilityLabel={c.stop} accessibilityState={{ disabled: sending }} disabled={sending} onPress={onStop} style={[styles.side, styles.stop, sending && { opacity: 0.4 }]} testID="assistant-mic-stop">
        <Icon name="stop" size={18} color={colors.night} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  tnum: { fontVariant: ["tabular-nums"] },
  mic: { width: HIT_TARGET, height: HIT_TARGET, alignItems: "center", justifyContent: "center" },
  bar: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 56, borderRadius: 28, borderWidth: 1, borderColor: colors.ivory14, backgroundColor: colors.glassFill, paddingHorizontal: 6 },
  side: { width: HIT_TARGET, height: HIT_TARGET, borderRadius: HIT_TARGET / 2, alignItems: "center", justifyContent: "center" },
  stop: { backgroundColor: colors.ivory },
});

/**
 * The Coordinator's message box. Without the mic (flag off, no route, no
 * speech key) it is exactly the kit's ChatComposer; with it, a mic sits before
 * the text and the box turns into the recording bar while a note is recorded
 * or turned into text. The recorder hook mounts only when the mic is on.
 */
export function CoordinatorComposer({
  mic,
  base,
  lang,
  askMic,
  onText,
  accessory,
  ...composer
}: ComposerProps & { mic: VoiceAvailability | null; base: string; lang: "en" | "es"; askMic: () => Promise<boolean>; onText: (text: string, receipt: string) => void; accessory?: React.ReactNode }) {
  if (!mic) return <ChatComposer {...composer} accessory={accessory} />;
  return <MicComposer mic={mic} base={base} lang={lang} askMic={askMic} onText={onText} accessory={accessory} {...composer} />;
}

function MicComposer({
  mic,
  base,
  lang,
  askMic,
  onText,
  accessory,
  ...composer
}: ComposerProps & { mic: VoiceAvailability; base: string; lang: "en" | "es"; askMic: () => Promise<boolean>; onText: (text: string, receipt: string) => void; accessory?: React.ReactNode }) {
  const voice = useVoiceNote({ base, lang, maxSeconds: mic.maxSeconds, onText, ask: askMic });
  if (voice.phase === "recording" || voice.phase === "sending") {
    return (
      <ChatComposer>
        <RecordingBar phase={voice.phase} durationMs={voice.durationMs} maxSeconds={mic.maxSeconds} onStop={() => void voice.stop()} onCancel={() => void voice.cancel()} />
      </ChatComposer>
    );
  }
  return (
    <ChatComposer
      {...composer}
      accessory={accessory}
      leading={<MicButton onPress={() => void voice.start()} busy={voice.phase === "starting"} disabled={composer.busy} />}
    />
  );
}

// Shared pieces for the task screens: the task form, the shared-board
// screens (used by couple and planner alike), pickers and small labels.

import React, { useMemo, useState } from "react";
import { View, Pressable, StyleSheet, Alert, ScrollView } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { fmt, relTime, shortDate, useLang, useCopy } from "@/i18n";
import { useFeatureCopy } from "@/i18n/feature";
import { post, del, ApiFailure } from "@/lib/api";
import { useOnline } from "@/lib/query";
import { usePlannerGuests } from "@/lib/hooks";
import { useGuestPages } from "@/features/guests/hooks";
import { useUserSession } from "@/lib/session";
import { Screen, TopBar, BigTitle, Card, T, Badge, Chip, ChipRow, Segmented, Input, Button, Avatar, ListRow, Sheet, EmptyState, Skeleton, SectionLabel, Row, Stack, Hairline, Icon, Banner } from "@/ui";
import { colors, HIT_TARGET } from "@/ui/tokens";
import { COPY } from "./copy";
import { addDays, addMonths, TASK_INVALIDATE, useSharedTask, type Board, type BoardStatus, type BoardTask, type TaskCategory, type TaskPriority, type TaskRecurrence, type TaskStatus, type TaskView } from "./hooks";
import { useSafeBack } from "@/lib/nav";
import { useUnsavedGuard } from "@/lib/unsaved";
import { DateInput } from "@/ui/Pickers";

type Lang = "en" | "es";

// ---------------------------------------------------------------- labels

export function dueLabel(t: Pick<TaskView, "days_left" | "status" | "completed_at" | "due_date">, copy: typeof COPY.en, lang: Lang): string | null {
  if (t.status === "done") return t.completed_at ? fmt(copy.completedAt, { when: relTime(t.completed_at, lang) }) : null;
  if (t.days_left === null) return null;
  if (t.days_left === 0) return copy.dueToday;
  if (t.days_left === 1) return copy.dueTomorrow;
  if (t.days_left > 1) return fmt(copy.dueIn, { n: t.days_left });
  if (t.days_left === -1) return copy.overdueOne;
  return fmt(copy.overdueBy, { n: -t.days_left });
}

export function dueColor(t: Pick<TaskView, "days_left" | "status">): string {
  if (t.status === "done") return colors.ivory40;
  if (t.days_left === null) return colors.ivory55;
  if (t.days_left < 0) return colors.red;
  if (t.days_left <= 7) return colors.amber;
  return colors.ivory55;
}

export function priorityKind(p: TaskPriority): "red" | "gold" | "mute" {
  return p === "high" ? "red" : p === "normal" ? "gold" : "mute";
}

export function errorText(err: unknown, lang: Lang, fallback: string): string {
  return (err instanceof ApiFailure ? err.messages[lang] : "") || fallback;
}

// ---------------------------------------------------------------- task row

export function TaskRowItem({ task, onToggle, onPress, last, readOnly }: { task: TaskView; onToggle: () => void; onPress: () => void; last?: boolean; readOnly?: boolean }) {
  const copy = useFeatureCopy(COPY);
  const { lang } = useLang();
  const done = task.status === "done";
  const due = dueLabel(task, copy, lang);
  const parts = [copy.categories[task.category], task.assignee?.name, due].filter(Boolean);
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={[styles.row, last && { borderBottomWidth: 0 }]}>
      <Pressable
        onPress={() => {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onToggle();
        }}
        disabled={readOnly}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: done, disabled: !!readOnly }}
        accessibilityLabel={done ? copy.reopen : copy.markDone}
        style={styles.checkHit}
      >
        {/* The pressable is 44 pt; the circle inside keeps its size (D-024). */}
        <View style={[styles.check, done && styles.checkOn]}>{done ? <Icon name="check" size={16} color={colors.night} strokeWidth={2.4} /> : null}</View>
      </Pressable>
      <View style={{ flex: 1, gap: 3 }}>
        <T v="body16" color={done ? colors.ivory55 : colors.ivory} style={done ? styles.strike : undefined} numberOfLines={2}>
          {task.title}
        </T>
        {parts.length ? (
          <T v="meta13" color={due && !done ? dueColor(task) : colors.ivory55} numberOfLines={1}>
            {parts.join(" · ")}
          </T>
        ) : null}
      </View>
      {task.priority === "high" && !done ? <Badge label={copy.priorities.high} kind="red" /> : null}
      {task.status === "blocked" ? <Badge label={copy.statuses.blocked} kind="amber" /> : null}
      <Icon name="chev" size={18} color={colors.ivory40} />
    </Pressable>
  );
}

// ---------------------------------------------------------------- pickers

export function OptionChips<TValue extends string>({ value, options, labels, onChange, disabled }: { value: TValue; options: readonly TValue[]; labels: Record<TValue, string>; onChange: (v: TValue) => void; disabled?: boolean }) {
  return (
    <ChipRow>
      {options.map((o) => (
        <Chip key={o} label={labels[o]} on={o === value} onPress={disabled ? undefined : () => onChange(o)} />
      ))}
    </ChipRow>
  );
}

export function DateField({ value, today, onChange, disabled, onInvalid }: { value: string | null; today: string; onChange: (v: string | null) => void; disabled?: boolean; onInvalid?: (invalid: boolean) => void }) {
  const copy = useFeatureCopy(COPY);
  // The system calendar (ui/Pickers): the value is always a whole date or
  // nothing, so the form is never held by a half-typed one.
  const pick = (v: string | null) => {
    onInvalid?.(false);
    onChange(v);
  };
  return (
    <View style={{ gap: 8 }}>
      <DateInput value={value} onChange={pick} disabled={disabled} placeholder={copy.fields.dueHint} initial={today} testID="task-due" />
      {disabled ? null : (
        <ChipRow>
          <Chip label={copy.dateChips.none} on={!value} onPress={() => pick(null)} />
          <Chip label={copy.dateChips.today} on={value === today} onPress={() => pick(today)} />
          <Chip label={copy.dateChips.week} on={value === addDays(today, 7)} onPress={() => pick(addDays(today, 7))} />
          <Chip label={copy.dateChips.month} on={value === addMonths(today, 1)} onPress={() => pick(addMonths(today, 1))} />
        </ChipRow>
      )}
    </View>
  );
}

const OFFSET_OPTIONS = [30, 14, 7, 3, 1, 0];

export function OffsetChips({ value, onChange, disabled }: { value: number[]; onChange: (v: number[]) => void; disabled?: boolean }) {
  return (
    <ChipRow>
      {OFFSET_OPTIONS.map((n) => {
        const on = value.includes(n);
        return (
          <Chip
            key={n}
            label={n === 0 ? "0" : String(n)}
            on={on}
            onPress={disabled ? undefined : () => {
              const next = on ? value.filter((x) => x !== n) : [...value, n];
              if (next.length > 5) return;
              onChange(next.sort((a, b) => b - a));
            }}
          />
        );
      })}
    </ChipRow>
  );
}

export type AssigneeValue = { kind: "user" | "collaborator"; id: string } | null;

export function AssigneePicker({ board, value, onChange, disabled }: { board: Board | undefined; value: AssigneeValue; onChange: (v: AssigneeValue) => void; disabled?: boolean }) {
  const copy = useFeatureCopy(COPY);
  const [open, setOpen] = useState(false);
  const current = value
    ? value.kind === "user"
      ? board?.members.find((m) => m.userId === value.id)?.name
      : board?.collaborators.find((c) => c.id === value.id)?.name
    : null;
  return (
    <>
      <Pressable onPress={() => setOpen(true)} disabled={disabled} accessibilityRole="button" accessibilityState={{ disabled: !!disabled }} style={styles.pickerRow}>
        <Avatar initials={initials(current ?? "")} size={34} gem={!current} />
        <T v="body16" color={current ? colors.ivory : colors.ivory55} style={{ flex: 1 }}>
          {current ?? copy.fields.noOwner}
        </T>
        {disabled ? null : <Icon name="down" size={18} color={colors.ivory40} />}
      </Pressable>
      <Sheet visible={open} onClose={() => setOpen(false)} top={120} scroll={false}>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }}>
          <T v="title26" style={{ marginBottom: 12 }}>
            {copy.fields.owner}
          </T>
          <ListRow
            leading={<Avatar gem size={36} />}
            title={copy.fields.noOwner}
            chevron={false}
            trailing={!value ? <Icon name="check" size={18} color={colors.goldLight} /> : undefined}
            onPress={() => {
              onChange(null);
              setOpen(false);
            }}
          />
          {board?.members.length ? <SectionLabel style={{ marginTop: 16, marginBottom: 4 }}>{copy.members}</SectionLabel> : null}
          {board?.members.map((m) => (
            <ListRow
              key={m.userId}
              leading={<Avatar initials={initials(m.name)} size={36} />}
              title={m.name}
              sub={m.email}
              chevron={false}
              trailing={value?.kind === "user" && value.id === m.userId ? <Icon name="check" size={18} color={colors.goldLight} /> : undefined}
              onPress={() => {
                onChange({ kind: "user", id: m.userId });
                setOpen(false);
              }}
            />
          ))}
          {board?.collaborators.length ? <SectionLabel style={{ marginTop: 16, marginBottom: 4 }}>{copy.helpers}</SectionLabel> : null}
          {board?.collaborators.map((c) => (
            <ListRow
              key={c.id}
              leading={<Avatar initials={initials(c.name)} size={36} />}
              title={c.name}
              sub={c.role_label || c.email}
              chevron={false}
              trailing={value?.kind === "collaborator" && value.id === c.id ? <Icon name="check" size={18} color={colors.goldLight} /> : undefined}
              onPress={() => {
                onChange({ kind: "collaborator", id: c.id });
                setOpen(false);
              }}
            />
          ))}
        </ScrollView>
      </Sheet>
    </>
  );
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function ConfirmSheet({ visible, title, body, confirmLabel, onConfirm, onClose, busy }: { visible: boolean; title: string; body?: string; confirmLabel: string; onConfirm: () => void; onClose: () => void; busy?: boolean }) {
  const copy = useFeatureCopy(COPY);
  return (
    <Sheet visible={visible} onClose={onClose} top={420}>
      <View style={{ paddingHorizontal: 20, gap: 12 }}>
        <T v="title26">{title}</T>
        {body ? (
          <T v="body15" color={colors.ivory70}>
            {body}
          </T>
        ) : null}
        <Button label={confirmLabel} onPress={onConfirm} loading={busy} style={{ marginTop: 8 }} />
        <Button label={copy.cancel} kind="ghost" onPress={onClose} />
      </View>
    </Sheet>
  );
}

// ---------------------------------------------------------------- task form

export type TaskFormValue = {
  title: string;
  notes: string;
  category: TaskCategory;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  recurrence: TaskRecurrence;
  remind_offsets_days: number[];
  assignee: AssigneeValue;
};

export function emptyForm(board: Board | undefined): TaskFormValue {
  return { title: "", notes: "", category: "other", status: "todo", priority: "normal", due_date: null, recurrence: "none", remind_offsets_days: board?.options.default_offsets ?? [7, 1], assignee: null };
}

export function formFromTask(t: TaskView): TaskFormValue {
  return {
    title: t.title,
    notes: t.notes,
    category: t.category,
    status: t.status,
    priority: t.priority,
    due_date: t.due_date,
    recurrence: t.recurrence,
    remind_offsets_days: t.remind_offsets_days,
    assignee: t.assignee_kind ? { kind: t.assignee_kind, id: (t.assignee_kind === "user" ? t.assignee_user_id : t.assignee_collaborator_id) ?? "" } : null,
  };
}

export function TaskForm({ board, value, onChange, showStatus, disabled, onValidityChange }: { board: Board | undefined; value: TaskFormValue; onChange: (v: TaskFormValue) => void; showStatus?: boolean; /** Read-only role: shows the task, changes nothing. */ disabled?: boolean; /** False while a field holds text that is not a valid value yet. */ onValidityChange?: (ok: boolean) => void }) {
  const copy = useFeatureCopy(COPY);
  const [more, setMore] = useState(false);
  const set = <K extends keyof TaskFormValue>(k: K, v: TaskFormValue[K]) => {
    if (!disabled) onChange({ ...value, [k]: v });
  };
  const today = board?.today ?? new Date().toISOString().slice(0, 10);
  const categories = board?.options.categories ?? (["legal", "venue", "vendors", "guests", "budget", "travel", "attire", "ceremony", "day_of", "other"] as TaskCategory[]);
  return (
    <Stack gap={18}>
      <Field label={copy.fields.title}>
        <Input value={value.title} onChangeText={(v) => set("title", v.slice(0, 120))} placeholder={copy.fields.title} autoFocus={!value.title && !disabled} editable={!disabled} />
      </Field>
      <Field label={copy.fields.dueDate}>
        <DateField value={value.due_date} today={today} onChange={(v) => set("due_date", v)} disabled={disabled} onInvalid={(bad) => onValidityChange?.(!bad)} />
      </Field>
      <Field label={copy.fields.owner}>
        <AssigneePicker board={board} value={value.assignee} onChange={(v) => set("assignee", v)} disabled={disabled} />
      </Field>
      <Field label={copy.fields.category}>
        <OptionChips value={value.category} options={categories} labels={copy.categories} onChange={(v) => set("category", v)} disabled={disabled} />
      </Field>
      {showStatus ? (
        <Field label={copy.fields.status}>
          <OptionChips value={value.status} options={board?.options.statuses ?? (["todo", "doing", "blocked", "done"] as TaskStatus[])} labels={copy.statuses} onChange={(v) => set("status", v)} disabled={disabled} />
        </Field>
      ) : null}
      <Pressable onPress={() => setMore((m) => !m)} accessibilityRole="button" style={{ minHeight: HIT_TARGET, justifyContent: "center" }}>
        <Row gap={6}>
          <T v="meta13" color={colors.goldLight}>
            {more ? copy.lessOptions : copy.moreOptions}
          </T>
          <Icon name={more ? "down" : "chev"} size={16} color={colors.goldLight} />
        </Row>
      </Pressable>
      {more ? (
        <>
          <Field label={copy.fields.notes}>
            <Input value={value.notes} onChangeText={(v) => set("notes", v.slice(0, 2000))} placeholder={copy.fields.notes} multiline editable={!disabled} style={{ minHeight: 96, alignItems: "flex-start" }} />
          </Field>
          <Field label={copy.fields.priority}>
            <OptionChips value={value.priority} options={board?.options.priorities ?? (["low", "normal", "high"] as TaskPriority[])} labels={copy.priorities} onChange={(v) => set("priority", v)} disabled={disabled} />
          </Field>
          <Field label={copy.fields.recurrence}>
            <OptionChips value={value.recurrence} options={board?.options.recurrences ?? (["none", "weekly", "monthly"] as TaskRecurrence[])} labels={copy.recurrences} onChange={(v) => set("recurrence", v)} disabled={disabled} />
          </Field>
          <Field label={copy.fields.reminders} hint={copy.fields.remindersHint}>
            <OffsetChips value={value.remind_offsets_days} onChange={(v) => set("remind_offsets_days", v)} disabled={disabled} />
          </Field>
        </>
      ) : null}
    </Stack>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 8 }}>
      <SectionLabel>{label}</SectionLabel>
      {children}
      {hint ? (
        <T v="meta13" color={colors.ivory55}>
          {hint}
        </T>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------- shared board (couple + planner)

function boardBase(surface: "couple" | "planner"): string {
  return surface === "couple" ? "/couple/tasks/board" : "/planner/tasks";
}

export function boardStatusKind(s: BoardStatus): "green" | "gold" | "mute" {
  return s === "done" ? "green" : s === "in_progress" ? "gold" : "mute";
}

export function SharedTaskRow({ task, onPress, last }: { task: BoardTask; onPress: () => void; last?: boolean }) {
  const copy = useFeatureCopy(COPY);
  const { lang } = useLang();
  const sub = [copy.assignedTo[task.assigned_to], task.guest_names.slice(0, 2).join(", "), relTime(task.updated_at, lang)].filter(Boolean).join(" · ");
  return (
    <ListRow
      leading={<Avatar initials={task.assigned_to === "planner" ? "P" : "C"} size={36} />}
      title={task.title}
      sub={sub}
      trailing={<Badge label={copy.boardStatuses[task.status]} kind={boardStatusKind(task.status)} />}
      onPress={onPress}
      last={last}
    />
  );
}

/** Detail of one shared task: fields, status, comments. Keyed by id, so the
 *  unsaved title, detail and comment of one task never show on another. */
export function SharedTaskScreen({ surface, id }: { surface: "couple" | "planner"; id: string }) {
  return <SharedTaskDetail key={`${surface}:${id}`} surface={surface} id={id} />;
}

function SharedTaskDetail({ surface, id }: { surface: "couple" | "planner"; id: string }) {
  const copy = useFeatureCopy(COPY);
  const { lang } = useLang();
  const back = useSafeBack();
  const qc = useQueryClient();
  const online = useOnline();
  const user = useUserSession();
  const canEdit = surface === "planner" ? true : (user?.me.can_edit ?? false);
  const mainQuery = useSharedTask(surface, id);
  const { data, isLoading } = mainQuery;
  const task = data?.task;
  const [title, setTitle] = useState<string | null>(null);
  const [detail, setDetail] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const base = boardBase(surface);

  const invalidate = async () => {
    for (const k of TASK_INVALIDATE) await qc.invalidateQueries({ queryKey: [k] });
  };

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    try {
      await post(`${base}/${id}`, body);
      await invalidate();
      setTitle(null);
      setDetail(null);
    } catch (err) {
      Alert.alert(copy.error, errorText(err, lang, copy.error));
    } finally {
      setBusy(false);
    }
  }

  async function sendComment() {
    const text = comment.trim();
    if (!text || busy) return;
    setBusy(true);
    try {
      await post(`${base}/${id}/comments`, { text });
      setComment("");
      await invalidate();
    } catch (err) {
      Alert.alert(copy.error, errorText(err, lang, copy.error));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await del(`${base}/${id}`);
      await invalidate();
      setConfirm(false);
      leave.release();
      back();
    } catch (err) {
      Alert.alert(copy.error, errorText(err, lang, copy.error));
    } finally {
      setBusy(false);
    }
  }

  const dirty = (title !== null && title !== task?.title) || (detail !== null && detail !== task?.detail);
  const leave = useUnsavedGuard(dirty && canEdit);

  return (
    <Screen query={mainQuery} header={<TopBar onBack={() => leave(back)} title={copy.segments.board} />} bottomInset={40} keyboard>
      {isLoading && !task ? <Skeleton h={160} r={18} /> : null}
      {task ? (
        <Stack gap={18}>
          <Row style={{ justifyContent: "space-between" }}>
            <Badge label={copy.boardStatuses[task.status]} kind={boardStatusKind(task.status)} />
            <T v="meta13" color={colors.ivory55}>
              {fmt(copy.createdBy, { who: copy.assignedTo[task.created_by_role] })} · {shortDate(task.created_at, lang)}
            </T>
          </Row>
          <Field label={copy.fields.title}>
            <Input value={title ?? task.title} onChangeText={setTitle} editable={canEdit} />
          </Field>
          <Field label={copy.fields.detail}>
            <Input value={detail ?? task.detail} onChangeText={setDetail} editable={canEdit} multiline style={{ minHeight: 96, alignItems: "flex-start" }} />
          </Field>
          {dirty && canEdit ? <Button label={copy.save} onPress={() => patch({ title: title ?? task.title, detail: detail ?? task.detail })} loading={busy} disabled={!online} /> : null}
          <Field label={copy.fields.status}>
            <Segmented<BoardStatus>
              value={task.status}
              options={[
                { value: "open", label: copy.boardStatuses.open },
                { value: "in_progress", label: copy.boardStatuses.in_progress },
                { value: "done", label: copy.boardStatuses.done },
              ]}
              onChange={(v) => canEdit && v !== task.status && patch({ status: v })}
            />
          </Field>
          <Field label={copy.fields.assignedTo}>
            <Segmented<"couple" | "planner">
              value={task.assigned_to}
              options={[
                { value: "couple", label: copy.assignedTo.couple },
                { value: "planner", label: copy.assignedTo.planner },
              ]}
              onChange={(v) => canEdit && v !== task.assigned_to && patch({ assigned_to: v })}
            />
          </Field>
          {task.guest_names.length ? (
            <Field label={copy.fields.guests}>
              <ChipRow>
                {task.guest_names.map((n) => (
                  <Chip key={n} label={n} />
                ))}
              </ChipRow>
            </Field>
          ) : null}
          <Hairline gold />
          <SectionLabel>{copy.comments}</SectionLabel>
          {!task.comments.length ? (
            <T v="body15" color={colors.ivory55}>
              {copy.noComments}
            </T>
          ) : null}
          {task.comments.map((c) => (
            <Card key={c.id} kind="solid" padding={14}>
              <Row style={{ justifyContent: "space-between", marginBottom: 6 }}>
                <T v="meta13" color={colors.goldLight}>
                  {copy.assignedTo[c.author_role]}
                </T>
                <T v="meta13" color={colors.ivory40}>
                  {relTime(c.created_at, lang)}
                </T>
              </Row>
              <T v="body15">{c.body}</T>
            </Card>
          ))}
          {canEdit ? (
            <Input
              value={comment}
              onChangeText={(v) => setComment(v.slice(0, 500))}
              placeholder={copy.addComment}
              returnKeyType="send"
              onSubmitEditing={sendComment}
              right={
                <Pressable onPress={sendComment} disabled={busy || !comment.trim() || !online} accessibilityRole="button" accessibilityLabel={copy.send} style={[styles.send, (!comment.trim() || !online) && { opacity: 0.4 }]}>
                  <Icon name="chev" size={20} color={colors.night} strokeWidth={2} />
                </Pressable>
              }
              style={{ paddingRight: 6 }}
            />
          ) : null}
          {surface === "couple" && canEdit ? <Button label={copy.delete} kind="ghost" onPress={() => setConfirm(true)} style={{ marginTop: 8 }} /> : null}
          {!canEdit ? (
            <T v="meta13" color={colors.ivory55} center>
              {copy.readOnly}
            </T>
          ) : null}
        </Stack>
      ) : null}
      <ConfirmSheet visible={confirm} title={copy.deleteConfirmTitle} body={copy.deleteConfirmBody} confirmLabel={copy.delete} onConfirm={remove} onClose={() => setConfirm(false)} busy={busy} />
    </Screen>
  );
}

/** New shared task, for either side. */
export function NewSharedTaskScreen({ surface }: { surface: "couple" | "planner" }) {
  const copy = useFeatureCopy(COPY);
  const { lang } = useLang();
  const back = useSafeBack();
  const qc = useQueryClient();
  const online = useOnline();
  const user = useUserSession();
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [assignedTo, setAssignedTo] = useState<"couple" | "planner">(surface);
  // Picked guests keep their names here: the search list changes with every
  // query, and a chip must not vanish when its guest is no longer in it.
  const [picked, setPicked] = useState<{ id: string; name: string }[]>([]);
  const guestIds = useMemo(() => picked.map((p) => p.id), [picked]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const slug = user?.me.tenant.slug ?? "";
  // Searches every guest server-side (paged, debounced), not just the first page.
  const coupleGuests = useGuestPages(q, "all", { enabled: surface === "couple" && q.trim().length >= 2 });
  const plannerGuests = usePlannerGuests(surface === "planner" ? slug : "");
  const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const candidates = useMemo(() => {
    if (surface === "couple") return coupleGuests.items.map((g) => ({ id: g.id, name: g.name }));
    return (plannerGuests.data?.guests ?? []).filter((g) => (q ? fold(g.name).includes(fold(q)) : true)).map((g) => ({ id: g.id, name: g.name }));
  }, [surface, coupleGuests.items, plannerGuests.data, q]);
  const chosen = picked;
  const [pickerOpen, setPickerOpen] = useState(false);
  const common = useCopy().common;
  const pickerEmpty = useCopy().core.pickerEmpty;
  // The couple's list is searched on the server from 2 letters; the planner's
  // whole list is already here.
  const showResults = surface === "planner" || q.trim().length >= 2;
  const closePicker = () => {
    setPickerOpen(false);
    setQ("");
  };
  const leave = useUnsavedGuard(!!title.trim() || !!detail.trim() || picked.length > 0);

  async function submit() {
    if (busy) return;
    if (!title.trim()) {
      Alert.alert(copy.errorTitle);
      return;
    }
    setBusy(true);
    try {
      await post(boardBase(surface), { title: title.trim(), detail: detail.trim(), assigned_to: assignedTo, guest_ids: guestIds });
      for (const k of TASK_INVALIDATE) await qc.invalidateQueries({ queryKey: [k] });
      leave.release();
      back();
    } catch (err) {
      Alert.alert(copy.error, errorText(err, lang, copy.error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen header={<TopBar onBack={() => leave(back)} title={copy.newBoardTask} />} bottomInset={40} keyboard>
      <Stack gap={18}>
        {!online ? <Banner icon="wifi-off" title={copy.offline} /> : null}
        <Field label={copy.fields.title}>
          <Input value={title} onChangeText={(v) => setTitle(v.slice(0, 120))} placeholder={copy.fields.title} autoFocus />
        </Field>
        <Field label={copy.fields.detail}>
          <Input value={detail} onChangeText={(v) => setDetail(v.slice(0, 2000))} placeholder={copy.fields.detail} multiline style={{ minHeight: 96, alignItems: "flex-start" }} />
        </Field>
        <Field label={copy.fields.assignedTo}>
          <Segmented<"couple" | "planner">
            value={assignedTo}
            options={[
              { value: "couple", label: copy.assignedTo.couple },
              { value: "planner", label: copy.assignedTo.planner },
            ]}
            onChange={setAssignedTo}
          />
        </Field>
        <Field label={copy.fields.guests}>
          {chosen.length ? (
            <ChipRow>
              {chosen.map((c) => (
                <Chip key={c.id} label={`${c.name} ×`} on onPress={() => setPicked((list) => list.filter((x) => x.id !== c.id))} />
              ))}
            </ChipRow>
          ) : null}
          {/* The guest search lives in a sheet: its results scroll in the room
              above the keyboard and a first tap picks a guest (K12). Before,
              the results opened under the keyboard with no way to reach them. */}
          <Pressable onPress={() => setPickerOpen(true)} accessibilityRole="button" accessibilityLabel={copy.fields.guests} style={styles.pickerRow} testID="task-guests-open">
            <Icon name="search" size={20} color={colors.ivory55} />
            <T v="body16" color={colors.ivory55} style={{ flex: 1 }}>
              {copy.fields.guests}
            </T>
            <Icon name="down" size={18} color={colors.ivory40} />
          </Pressable>
          <Sheet visible={pickerOpen} onClose={closePicker} top={120} scroll={false} footer={<Button label={common.done} onPress={closePicker} />}>
            <View style={{ flex: 1, gap: 10 }}>
              <T v="title26">{copy.fields.guests}</T>
              <Input icon="search" value={q} onChangeText={setQ} placeholder={copy.fields.guests} autoCorrect={false} autoFocus />
              <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" showsVerticalScrollIndicator={false}>
                {showResults && candidates.length ? (
                  <Card kind="solid" padding={2} style={{ paddingHorizontal: 14 }}>
                    {candidates.slice(0, 40).map((c, i, arr) => (
                      <ListRow
                        key={c.id}
                        title={c.name}
                        chevron={false}
                        trailing={guestIds.includes(c.id) ? <Icon name="check" size={18} color={colors.goldLight} /> : undefined}
                        onPress={() => setPicked((list) => (list.some((x) => x.id === c.id) ? list.filter((x) => x.id !== c.id) : list.length < 10 ? [...list, c] : list))}
                        last={i === arr.length - 1}
                      />
                    ))}
                  </Card>
                ) : showResults ? (
                  <T v="body15" color={colors.ivory55}>
                    {pickerEmpty}
                  </T>
                ) : null}
              </ScrollView>
            </View>
          </Sheet>
        </Field>
        <Button label={copy.addBoard} onPress={submit} loading={busy} disabled={!online || busy} style={{ marginTop: 8 }} />
      </Stack>
    </Screen>
  );
}

// ---------------------------------------------------------------- misc

export function EmptyList({ title, body, action }: { title: string; body?: string; action?: React.ReactNode }) {
  return <EmptyState title={title} body={body} action={action} />;
}

export function ScreenTitle({ title, sub }: { title: string; sub?: string }) {
  return <BigTitle title={title} sub={sub} />;
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 64, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.ivory09 },
  checkHit: { width: 44, height: 44, alignItems: "center", justifyContent: "center", marginLeft: -9, marginRight: -9 },
  check: { width: 26, height: 26, borderRadius: 13, borderWidth: 1.5, borderColor: colors.goldBorder, alignItems: "center", justifyContent: "center" },
  checkOn: { backgroundColor: colors.gold, borderColor: colors.gold },
  strike: { textDecorationLine: "line-through" },
  pickerRow: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 52, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1, borderColor: colors.ivory14, backgroundColor: colors.glassSolidFill },
  send: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.gold, alignItems: "center", justifyContent: "center" },
});

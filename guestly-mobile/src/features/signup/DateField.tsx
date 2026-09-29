// Wedding date: a field that opens a month calendar in a sheet. Pure JS (no
// native picker module), Monday first, today to five years out, the chosen
// day in gold. Emits YYYY-MM-DD or null ("no date yet").

import React, { useMemo, useState } from "react";
import { View, Pressable, StyleSheet } from "react-native";
import * as Haptics from "expo-haptics";
import { longDate, useLang } from "@/i18n";
import { useFeatureCopy } from "@/i18n/feature";
import { T, Row, Icon, IconButton, Sheet, Button, Stack } from "@/ui";
import { colors, radius } from "@/ui/tokens";
import { COPY } from "./copy";

function iso(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function todayIso(): string {
  const n = new Date();
  return iso(n.getFullYear(), n.getMonth(), n.getDate());
}

export function DateField({
  value,
  onChange,
  label,
  placeholder,
  testID,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
  label: string;
  placeholder: string;
  testID?: string;
}) {
  const { lang } = useLang();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable
        testID={testID}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value ? longDate(value, lang) : placeholder}`}
        style={({ pressed }) => [styles.field, pressed && { opacity: 0.85 }]}
      >
        <Icon name="calendar" size={20} color={colors.ivory55} />
        <T v="body15" color={value ? colors.ivory : colors.ivory55} style={{ flex: 1 }} numberOfLines={1}>
          {value ? longDate(value, lang) : placeholder}
        </T>
        <Icon name="down" size={18} color={colors.ivory40} />
      </Pressable>
      <Sheet visible={open} onClose={() => setOpen(false)} top={140}>
        <Calendar
          value={value}
          onDone={(v) => {
            onChange(v);
            setOpen(false);
          }}
        />
      </Sheet>
    </>
  );
}

function Calendar({ value, onDone }: { value: string | null; onDone: (v: string | null) => void }) {
  const c = useFeatureCopy(COPY).calendar;
  const { lang } = useLang();
  const today = todayIso();
  const max = useMemo(() => {
    const n = new Date();
    return iso(n.getFullYear() + 5, n.getMonth(), n.getDate());
  }, []);
  const start = value ?? today;
  const [cursor, setCursor] = useState({ y: Number(start.slice(0, 4)), m: Number(start.slice(5, 7)) - 1 });
  const [picked, setPicked] = useState<string | null>(value);

  // Capital on the first letter only ("Septiembre de 2026", never "De").
  const rawTitle = new Date(cursor.y, cursor.m, 15).toLocaleDateString(lang === "es" ? "es-BO" : "en-GB", { month: "long", year: "numeric" });
  const monthTitle = rawTitle.charAt(0).toUpperCase() + rawTitle.slice(1);
  const firstWeekday = (new Date(cursor.y, cursor.m, 1).getDay() + 6) % 7; // Monday = 0
  const daysInMonth = new Date(cursor.y, cursor.m + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(firstWeekday).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  // Always six weeks, so the sheet keeps one height and the arrows stay put.
  while (cells.length < 42) cells.push(null);

  const monthIndex = cursor.y * 12 + cursor.m;
  const canPrev = monthIndex > Number(today.slice(0, 4)) * 12 + Number(today.slice(5, 7)) - 1;
  const canNext = monthIndex < Number(max.slice(0, 4)) * 12 + Number(max.slice(5, 7)) - 1;
  const shift = (delta: number) =>
    setCursor(({ y, m }) => {
      const n = m + delta;
      return { y: y + Math.floor(n / 12), m: ((n % 12) + 12) % 12 };
    });

  return (
    <Stack gap={14}>
      <Row style={{ justifyContent: "space-between" }}>
        <IconButton name="back" label={c.prev} onPress={canPrev ? () => shift(-1) : undefined} style={!canPrev ? { opacity: 0.25 } : undefined} />
        <T v="title26">
          {monthTitle}
        </T>
        <View style={{ transform: [{ scaleX: -1 }] }}>
          <IconButton name="back" label={c.next} onPress={canNext ? () => shift(1) : undefined} style={!canNext ? { opacity: 0.25 } : undefined} />
        </View>
      </Row>
      <View>
        <Row gap={0}>
          {c.weekdays.map((w, i) => (
            <T key={i} v="label11" color={colors.ivory40} center style={{ flex: 1 }}>
              {w}
            </T>
          ))}
        </Row>
        {Array.from({ length: cells.length / 7 }, (_, row) => (
          <Row key={row} gap={0} style={{ marginTop: 4 }}>
            {cells.slice(row * 7, row * 7 + 7).map((d, i) => {
              if (!d) return <View key={i} style={styles.day} />;
              const day = iso(cursor.y, cursor.m, d);
              const disabled = day < today || day > max;
              const selected = day === picked;
              return (
                <Pressable
                  key={i}
                  disabled={disabled}
                  onPress={() => {
                    void Haptics.selectionAsync();
                    setPicked(day);
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected, disabled }}
                  accessibilityLabel={longDate(day, lang)}
                  style={styles.day}
                >
                  <View style={[styles.dayInner, selected && styles.daySelected, day === today && !selected && styles.dayToday]}>
                    <T v="body15" color={selected ? colors.night : disabled ? colors.ivory25 : colors.ivory} center>
                      {d}
                    </T>
                  </View>
                </Pressable>
              );
            })}
          </Row>
        ))}
      </View>
      <T v="meta13" color={colors.goldLight} center style={{ minHeight: 20 }}>
        {picked ? longDate(picked, lang) : ""}
      </T>
      <Row gap={10}>
        <Button kind="ghost" label={c.clear} onPress={() => onDone(null)} style={{ flex: 1 }} small />
        <Button label={c.done} onPress={() => onDone(picked)} disabled={!picked} style={{ flex: 1 }} small />
      </Row>
    </Stack>
  );
}

const styles = StyleSheet.create({
  field: {
    minHeight: 52,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: "rgba(247,243,236,0.12)",
    backgroundColor: colors.glassSolidFill,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  day: { flex: 1, aspectRatio: 1, maxHeight: 48, alignItems: "center", justifyContent: "center" },
  dayInner: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  daySelected: { backgroundColor: colors.gold },
  dayToday: { borderWidth: 1, borderColor: colors.goldBorder },
});

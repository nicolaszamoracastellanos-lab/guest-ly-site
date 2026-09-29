// Native date and time fields (QA Sep 29: task dates, runsheet times and
// payment dates were typed as raw YYYY-MM-DD and HH:MM). The value stays the
// exact string the portal stores, "YYYY-MM-DD" or "HH:MM" (never a JS Date
// across the API, so no time zone can move a day); only the picking is native.
//
// iOS: the field opens a sheet with the system calendar (dates) or wheel
// (times), dark, gold accent, Done to keep and Clear to empty it.
// Android: the system dialog. Web (the test rig): the old typed field.

import React, { useState } from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { useCopy, useLang, longDate } from "@/i18n";
import { T } from "./Text";
import { Icon } from "./Icon";
import { colors, radius } from "./tokens";
import { Button, ButtonRow, Input, Sheet, useFieldLabel } from "./index";

type Mode = "date" | "time";

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^\d{2}:\d{2}$/;

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** "YYYY-MM-DD" or "HH:MM" to a local Date the picker can show. */
function toDate(mode: Mode, value: string | null | undefined, fallback?: string | null): Date {
  const now = new Date();
  const v = value || fallback;
  if (mode === "date" && v && DAY.test(v)) {
    const [y, m, d] = v.split("-").map(Number);
    return new Date(y, m - 1, d, 12, 0, 0);
  }
  if (mode === "time" && v && TIME.test(v)) {
    const [h, m] = v.split(":").map(Number);
    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0);
  }
  if (mode === "time") return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 18, 0, 0);
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0);
}

function fromDate(mode: Mode, d: Date): string {
  return mode === "date" ? `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` : `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** How the stored value reads on the field. */
function shown(mode: Mode, value: string | null | undefined, lang: "en" | "es"): string {
  if (!value) return "";
  if (mode === "date") return DAY.test(value) ? longDate(value, lang) : value;
  if (!TIME.test(value)) return value;
  // Spanish reads the 24 h clock as stored ("18:30"); English a 12 h one
  // ("6:30 PM"). Built by hand: locale formats put a narrow no-break space
  // and "p. m." in that broke over two lines in a half-width field.
  if (lang === "es") return value;
  const [h, m] = value.split(":").map(Number);
  return `${h % 12 || 12}:${pad(m)} ${h < 12 ? "AM" : "PM"}`;
}

type FieldProps = {
  value: string | null | undefined;
  onChange: (v: string | null) => void;
  placeholder?: string;
  /** Offer Clear (an optional date or time). */
  clearable?: boolean;
  disabled?: boolean;
  /** For the sheet title and VoiceOver when the field is not inside a Field. */
  label?: string;
  /** Where the calendar or wheel opens when the field is empty. */
  initial?: string | null;
  minimumDate?: string | null;
  testID?: string;
};

function PickerField({ mode, value, onChange, placeholder, clearable = true, disabled, label, initial, minimumDate, testID }: FieldProps & { mode: Mode }) {
  const copy = useCopy().common;
  const { lang } = useLang();
  const fieldLabel = useFieldLabel();
  const name = label ?? fieldLabel ?? (mode === "date" ? copy.pickDate : copy.pickTime);
  const [open, setOpen] = useState(false);
  const [temp, setTemp] = useState<Date>(() => toDate(mode, value, initial));
  const text = shown(mode, value, lang);
  // es-ES: the Spanish wheel shows the 24 h clock, like the field.
  const locale = lang === "es" ? "es-ES" : "en-US";
  const min = mode === "date" && minimumDate && DAY.test(minimumDate) ? toDate("date", minimumDate) : undefined;

  if (Platform.OS === "web") {
    return (
      <Input
        value={value ?? ""}
        editable={!disabled}
        onChangeText={(t) => {
          const clean = t.replace(mode === "date" ? /[^0-9-]/g : /[^0-9:]/g, "").slice(0, mode === "date" ? 10 : 5);
          if (!clean) onChange(null);
          else if ((mode === "date" ? DAY : TIME).test(clean)) onChange(clean);
        }}
        placeholder={mode === "date" ? "YYYY-MM-DD" : "HH:MM"}
        accessibilityLabel={name}
      />
    );
  }

  const openPicker = () => {
    if (disabled) return;
    const start = toDate(mode, value, initial);
    if (Platform.OS === "android") {
      DateTimePickerAndroid.open({
        value: start,
        mode,
        is24Hour: lang === "es",
        minimumDate: min,
        onValueChange: (_e, d) => onChange(fromDate(mode, d)),
        ...(clearable && value ? { neutralButton: { label: copy.clear }, onNeutralButtonPress: () => onChange(null) } : {}),
      });
      return;
    }
    setTemp(start);
    setOpen(true);
  };

  return (
    <>
      <Pressable
        testID={testID}
        onPress={openPicker}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={text ? `${name}, ${text}` : name}
        accessibilityHint={placeholder}
        accessibilityState={{ disabled: !!disabled }}
        style={({ pressed }) => [styles.field, disabled && { opacity: 0.5 }, pressed && { opacity: 0.8 }]}
      >
        <Icon name={mode === "date" ? "calendar" : "clock"} size={20} color={colors.ivory55} />
        <T v="body16" color={text ? colors.ivory : colors.ivory55} style={{ flex: 1 }} numberOfLines={mode === "time" ? 1 : 2}>
          {text || placeholder || (mode === "time" ? "hh:mm" : copy.pickDate)}
        </T>
        {disabled ? null : <Icon name="down" size={18} color={colors.ivory40} />}
      </Pressable>
      {Platform.OS === "ios" ? (
        <Sheet visible={open} onClose={() => setOpen(false)}>
          <T v="title26">{name}</T>
          <View style={styles.picker}>
            <DateTimePicker
              value={temp}
              mode={mode}
              display={mode === "date" ? "inline" : "spinner"}
              themeVariant="dark"
              accentColor={colors.gold}
              textColor={colors.ivory}
              locale={locale}
              minuteInterval={mode === "time" ? 5 : undefined}
              minimumDate={min}
              onValueChange={(_e, d) => setTemp(d)}
              // The native view reports no size of its own to the layout:
              // without one the calendar spilled out of the bottom of the sheet.
              style={mode === "date" ? styles.calendar : styles.wheel}
            />
          </View>
          <ButtonRow>
            {clearable && value ? (
              <Button
                label={copy.clear}
                kind="ghost"
                onPress={() => {
                  onChange(null);
                  setOpen(false);
                }}
              />
            ) : null}
            <Button
              testID={testID ? `${testID}-done` : undefined}
              label={copy.done}
              onPress={() => {
                onChange(fromDate(mode, temp));
                setOpen(false);
              }}
            />
          </ButtonRow>
        </Sheet>
      ) : null}
    </>
  );
}

/** A "YYYY-MM-DD" date, picked on the system calendar. */
export function DateInput(props: FieldProps) {
  return <PickerField mode="date" {...props} />;
}

/** An "HH:MM" time (24 h, as stored), picked on the system wheel. */
export function TimeInput(props: FieldProps) {
  return <PickerField mode="time" {...props} />;
}

const styles = StyleSheet.create({
  field: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 52, borderRadius: radius.pill, paddingHorizontal: 18, paddingVertical: 10, backgroundColor: colors.glassSolidFill, borderWidth: 1, borderColor: "rgba(247,243,236,0.12)" },
  picker: { alignItems: "center", marginVertical: 8 },
  calendar: { width: "100%", maxWidth: 380, height: 350 },
  wheel: { width: "100%", maxWidth: 380, height: 216 },
});

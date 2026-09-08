// Runsheet data and the shared block form. day / starts_at / ends_at are
// raw strings (YYYY-MM-DD, HH:MM) end to end: never a JS Date.

import React, { useState } from "react";
import { View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { get } from "@/lib/api";
import { useFeatureCopy } from "@/i18n/feature";
import {
  T,
  Input,
  Segmented,
  SectionLabel,
  Stack,
  Row,
  Chip,
  ChipRow,
} from "@/ui";
import { colors } from "@/ui/tokens";
import { COPY } from "./copy";

export type RunsheetStatus = "planned" | "confirmed" | "done";
export type RunsheetBlock = {
  id: string;
  day: string;
  starts_at: string;
  ends_at: string | null;
  title: string;
  detail: string;
  location: string;
  owner: string;
  vendor_id: string | null;
  vendor_name: string | null;
  status: RunsheetStatus;
  sort_order: number;
};
export type RunsheetSurface = {
  pending: boolean;
  wedding_date: string | null;
  days: { day: string; blocks: RunsheetBlock[] }[];
  blocks_total: number;
  vendors: { id: string; name: string }[];
  ics_url: string;
  can_edit: boolean;
  statuses: RunsheetStatus[];
};

export const RUNSHEET_KEY = ["couple-runsheet"];
export const PLANNER_RUNSHEET_KEY = ["planner-runsheet"];
export const useCoupleRunsheet = () =>
  useQuery({
    queryKey: RUNSHEET_KEY,
    queryFn: () => get<RunsheetSurface>("/couple/runsheet"),
  });
export const usePlannerRunsheet = () =>
  useQuery({
    queryKey: PLANNER_RUNSHEET_KEY,
    queryFn: () => get<RunsheetSurface>("/planner/runsheet"),
  });

export const STATUS_ORDER: RunsheetStatus[] = ["planned", "confirmed", "done"];
export function nextStatus(s: RunsheetStatus): RunsheetStatus {
  return STATUS_ORDER[(STATUS_ORDER.indexOf(s) + 1) % STATUS_ORDER.length];
}
export function statusKind(s: RunsheetStatus): "mute" | "gold" | "green" {
  return s === "done" ? "green" : s === "confirmed" ? "gold" : "mute";
}

export type BlockForm = {
  day: string;
  starts_at: string;
  ends_at: string;
  title: string;
  detail: string;
  location: string;
  owner: string;
  vendor_id: string;
  status: RunsheetStatus;
};

export function emptyForm(day: string | null): BlockForm {
  return {
    day: day ?? "",
    starts_at: "",
    ends_at: "",
    title: "",
    detail: "",
    location: "",
    owner: "",
    vendor_id: "",
    status: "planned",
  };
}

export function formFromBlock(b: RunsheetBlock): BlockForm {
  return {
    day: b.day,
    starts_at: b.starts_at,
    ends_at: b.ends_at ?? "",
    title: b.title,
    detail: b.detail,
    location: b.location,
    owner: b.owner,
    vendor_id: b.vendor_id ?? "",
    status: b.status,
  };
}

/** Masks typed digits into HH:MM. */
export function maskTime(raw: string): string {
  const d = raw.replace(/[^0-9]/g, "").slice(0, 4);
  if (d.length <= 2) return d;
  return `${d.slice(0, 2)}:${d.slice(2)}`;
}
/** Masks typed digits into YYYY-MM-DD. */
export function maskDay(raw: string): string {
  const d = raw.replace(/[^0-9]/g, "").slice(0, 8);
  if (d.length <= 4) return d;
  if (d.length <= 6) return `${d.slice(0, 4)}-${d.slice(4)}`;
  return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6)}`;
}
export const isDay = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);
export const isTime = (v: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(v);

export function validate(f: BlockForm, c: (typeof COPY)["en"]): string | null {
  if (!f.title.trim()) return c.errorTitle;
  if (!isDay(f.day)) return c.errorDay;
  if (!isTime(f.starts_at)) return c.errorStart;
  return null;
}

export function toBody(f: BlockForm) {
  return {
    day: f.day,
    starts_at: f.starts_at,
    ends_at: isTime(f.ends_at) ? f.ends_at : null,
    title: f.title.trim(),
    detail: f.detail.trim(),
    location: f.location.trim(),
    owner: f.owner.trim(),
    vendor_id: f.vendor_id || null,
    status: f.status,
  };
}

export function BlockFormFields({
  form,
  onChange,
  vendors,
}: {
  form: BlockForm;
  onChange: (f: BlockForm) => void;
  vendors: { id: string; name: string }[];
}) {
  const c = useFeatureCopy(COPY);
  const [vendorOpen, setVendorOpen] = useState(false);
  const set = (patch: Partial<BlockForm>) => onChange({ ...form, ...patch });
  const vendorName =
    vendors.find((v) => v.id === form.vendor_id)?.name ?? c.noVendor;
  return (
    <Stack gap={14}>
      <View>
        <SectionLabel>{c.titleField}</SectionLabel>
        <Input
          value={form.title}
          onChangeText={(t) => set({ title: t.slice(0, 120) })}
          style={{ marginTop: 6 }}
        />
      </View>
      <Row gap={10} align="flex-start">
        <View style={{ flex: 1.3 }}>
          <SectionLabel>{c.day}</SectionLabel>
          <Input
            value={form.day}
            onChangeText={(t) => set({ day: maskDay(t) })}
            placeholder={c.dayHint}
            keyboardType="number-pad"
            style={{ marginTop: 6 }}
          />
        </View>
        <View style={{ flex: 1 }}>
          <SectionLabel>{c.start}</SectionLabel>
          <Input
            value={form.starts_at}
            onChangeText={(t) => set({ starts_at: maskTime(t) })}
            placeholder={c.timeHint}
            keyboardType="number-pad"
            style={{ marginTop: 6 }}
          />
        </View>
        <View style={{ flex: 1 }}>
          <SectionLabel>{c.end}</SectionLabel>
          <Input
            value={form.ends_at}
            onChangeText={(t) => set({ ends_at: maskTime(t) })}
            placeholder={c.timeHint}
            keyboardType="number-pad"
            style={{ marginTop: 6 }}
          />
        </View>
      </Row>
      <View>
        <SectionLabel>{c.status}</SectionLabel>
        <View style={{ marginTop: 6 }}>
          <Segmented<RunsheetStatus>
            value={form.status}
            options={STATUS_ORDER.map((s) => ({
              value: s,
              label: c.statuses[s],
            }))}
            onChange={(v) => set({ status: v })}
          />
        </View>
      </View>
      <View>
        <SectionLabel>{c.location}</SectionLabel>
        <Input
          value={form.location}
          onChangeText={(t) => set({ location: t.slice(0, 200) })}
          style={{ marginTop: 6 }}
        />
      </View>
      <View>
        <SectionLabel>{c.owner}</SectionLabel>
        <Input
          value={form.owner}
          onChangeText={(t) => set({ owner: t.slice(0, 120) })}
          placeholder={c.ownerHint}
          style={{ marginTop: 6 }}
        />
      </View>
      {vendors.length ? (
        <View>
          <SectionLabel>{c.vendor}</SectionLabel>
          <View style={{ marginTop: 6 }}>
            {vendorOpen ? (
              <ChipRow>
                <Chip
                  label={c.noVendor}
                  on={!form.vendor_id}
                  onPress={() => {
                    set({ vendor_id: "" });
                    setVendorOpen(false);
                  }}
                />
                {vendors.map((v) => (
                  <Chip
                    key={v.id}
                    label={v.name}
                    on={form.vendor_id === v.id}
                    onPress={() => {
                      set({ vendor_id: v.id });
                      setVendorOpen(false);
                    }}
                  />
                ))}
              </ChipRow>
            ) : (
              <Chip
                label={vendorName}
                on={!!form.vendor_id}
                onPress={() => setVendorOpen(true)}
              />
            )}
          </View>
        </View>
      ) : null}
      <View>
        <SectionLabel>{c.detail}</SectionLabel>
        <Input
          value={form.detail}
          onChangeText={(t) => set({ detail: t.slice(0, 2000) })}
          multiline
          style={{
            marginTop: 6,
            minHeight: 96,
            alignItems: "flex-start",
            paddingTop: 12,
          }}
        />
      </View>
      <T v="meta13" color={colors.ivory40}>
        {c.endHint}: {c.end}
      </T>
    </Stack>
  );
}

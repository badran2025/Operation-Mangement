"use client";
import { useI18n } from "@/lib/i18n/client";
import type { SteamSettings } from "@/lib/steam";
import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/SubmitButton";
import { NumberInput } from "@/components/NumberInput";
import { Field, FieldLabel } from "@/components/ui/field";
import { saveSteamSettings } from "./actions";

const KEYS = ["dryer_kg_h", "press_kg_h", "dryer_cycle_min", "dryer_valve_factor", "presses_per_item", "seconds_per_press"] as const;

export function SteamSettingsForm({ settings }: { settings: SteamSettings }) {
  const { t } = useI18n();
  const S = t.diesel.steam.settings;
  return (
    <ActionForm action={saveSteamSettings} className="grid gap-3 rounded-[14px] bg-surface p-3 sm:grid-cols-3">
      <p className="text-sm font-semibold sm:col-span-3">{S.title}<span className="block text-[12.5px] font-normal text-ink-muted">{S.hint}</span></p>
      {KEYS.map((k) => (
        <Field key={k}>
          <FieldLabel htmlFor={`ss-${k}`}>{S[k]}</FieldLabel>
          <NumberInput id={`ss-${k}`} name={k} required defaultValue={k === "dryer_valve_factor" ? Math.round(settings[k] * 1000) / 10 : settings[k]} />
        </Field>
      ))}
      <div className="sm:col-span-3"><SubmitButton>{S.save}</SubmitButton></div>
    </ActionForm>
  );
}

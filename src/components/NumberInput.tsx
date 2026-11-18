"use client";
import * as React from "react";
import { Input } from "@/components/ui/input";
import { latinDigits } from "@/lib/numbers";

/**
 * A number box that accepts Arabic digits too (١٢٣ → 123) and shows the
 * number keypad on phones. Works controlled (value/onChange) or with defaultValue.
 */
export function NumberInput({ onChange, min, max, step, ...props }: Omit<React.ComponentProps<typeof Input>, "type">) {
  void step;
  return (
    <Input
      {...props}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      dir="ltr"
      pattern="-?[0-9]*[.]?[0-9]*"
      data-min={min} data-max={max}
      onChange={(e) => {
        const clean = latinDigits(e.target.value).replace(/[^0-9.\-]/g, "");
        if (clean !== e.target.value) e.target.value = clean;
        onChange?.(e);
      }}
    />
  );
}

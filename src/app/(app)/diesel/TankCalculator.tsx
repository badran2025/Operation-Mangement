"use client";
import { CalculatorIcon, ChevronDownIcon } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";

/**
 * The CalculatorSoup tank calculator, embedded as they allow, with their credit
 * line kept. Loaded only when opened, to keep the page light.
 */
export function TankCalculator() {
  const { t } = useI18n();
  const C = t.diesel.tanks.calculator;
  return (
    <details className="group mt-4 rounded-[14px] bg-canvas">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3.5 py-3 text-sm font-semibold [&::-webkit-details-marker]:hidden">
        <CalculatorIcon className="size-4 text-primary" aria-hidden />
        <span className="flex-1">{C.title}</span>
        <ChevronDownIcon className="size-4 text-ink-muted transition-transform duration-150 group-open:rotate-180" aria-hidden />
      </summary>
      <div className="flex flex-col items-center gap-2 border-t border-hairline px-3.5 py-4">
        <p className="self-stretch text-[13px] text-ink-muted">{C.hint}</p>
        <iframe
          src="https://www.calculatorsoup.com/calculators/construction/tank.php?do=pop&opt=1&wbgcolor=03729e"
          title="Tank Volume Calculator" loading="lazy"
          className="h-[768px] w-full max-w-[400px] rounded-[6px] border border-black bg-white"
        />
        {/* Calculator Copyright CalculatorSoup, LLC www.calculatorsoup.com - used with permission under their widget terms */}
        <p className="text-center text-[12px] text-ink-muted" dir="ltr">
          <a href="https://www.calculatorsoup.com/calculators/construction/tank.php" target="_blank" rel="noopener" className="font-semibold hover:underline">Tank Volume Calculator</a>
          {" "}by{" "}
          <a href="https://www.calculatorsoup.com" target="_blank" rel="noopener" className="hover:underline">CalculatorSoup®</a>
        </p>
      </div>
    </details>
  );
}

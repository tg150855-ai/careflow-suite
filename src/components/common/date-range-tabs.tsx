import { useMemo, useState } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export type RangePreset = "day" | "month" | "year" | "all";
export type DateRange = { from: Date; to: Date; preset: RangePreset };

function startOfDay(d: Date) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function endOfDay(d: Date) { const x = new Date(d); x.setHours(23, 59, 59, 999); return x; }

export function computeRange(preset: RangePreset, ref: Date = new Date()): DateRange {
  const to = endOfDay(ref);
  const from = new Date(ref);
  if (preset === "day") from.setHours(0, 0, 0, 0);
  else if (preset === "month") { from.setDate(1); from.setHours(0, 0, 0, 0); }
  else if (preset === "year") { from.setMonth(0, 1); from.setHours(0, 0, 0, 0); }
  else { from.setFullYear(1970, 0, 1); from.setHours(0, 0, 0, 0); }
  return { from, to, preset };
}

type Props = {
  value: RangePreset;
  onChange: (preset: RangePreset, range: DateRange) => void;
  showAll?: boolean;
  className?: string;
};

/** Day | Month | Year (+ optional All) filter tabs. Stateless — parent owns the value. */
export function DayMonthYearTabs({ value, onChange, showAll = true, className }: Props) {
  return (
    <Tabs
      value={value}
      onValueChange={(v) => onChange(v as RangePreset, computeRange(v as RangePreset))}
      className={className}
    >
      <TabsList className="h-8">
        <TabsTrigger value="day" className="text-xs h-7 px-3">Day</TabsTrigger>
        <TabsTrigger value="month" className="text-xs h-7 px-3">Month</TabsTrigger>
        <TabsTrigger value="year" className="text-xs h-7 px-3">Year</TabsTrigger>
        {showAll && <TabsTrigger value="all" className="text-xs h-7 px-3">All</TabsTrigger>}
      </TabsList>
    </Tabs>
  );
}

/** Convenience hook: returns [range, preset, setPreset]. */
export function useDateRange(initial: RangePreset = "month") {
  const [preset, setPreset] = useState<RangePreset>(initial);
  const range = useMemo(() => computeRange(preset), [preset]);
  return { range, preset, setPreset };
}

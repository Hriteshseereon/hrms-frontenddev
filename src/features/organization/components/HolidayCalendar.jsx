import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Local YYYY-MM-DD. `toISOString()` is UTC: the grid's local-midnight cells mapped to the previous day in IST, so every
 *  holiday rendered one day late (Independence Day showed on 16 Aug). */
const iso = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const parse = (s) => new Date(s + "T00:00:00");
const addDays = (d, n) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};
const startOfWeek = (d) => addDays(d, -((d.getDay() + 6) % 7));

export const typeTone = (t) =>
  /public|national/i.test(t)
    ? "border-primary/30 bg-primary/10 text-primary"
    : /festival/i.test(t)
      ? "border-gold/40 bg-gold/15 text-gold"
      : /optional|restricted/i.test(t)
        ? "border-border bg-muted text-muted-foreground"
        : "border-primary/20 bg-primary/5 text-primary";

/** Month / Week / Year holiday calendar. */
export function HolidayCalendar({ holidays }) {
  const [view, setView] = useState("month");
  const [cursor, setCursor] = useState(() => new Date(2026, 6, 1));

  const byDate = useMemo(() => {
    const map = new Map();
    for (const h of holidays) {
      const from = parse(h.from);
      const to = parse(h.to || h.from);
      for (let d = new Date(from); d <= to; d = addDays(d, 1)) {
        const k = iso(d);
        map.set(k, [...(map.get(k) ?? []), h]);
      }
    }
    return map;
  }, [holidays]);

  const shift = (dir) => {
    const d = new Date(cursor);
    if (view === "month") d.setMonth(d.getMonth() + dir);
    else if (view === "week") d.setDate(d.getDate() + dir * 7);
    else d.setFullYear(d.getFullYear() + dir);
    setCursor(d);
  };

  const label =
    view === "year"
      ? String(cursor.getFullYear())
      : view === "month"
        ? `${MONTHS[cursor.getMonth()]} ${cursor.getFullYear()}`
        : `Week of ${iso(startOfWeek(cursor))}`;

  return (
    <Card className="shadow-card">
      <CardContent className="space-y-4 p-5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap items-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={() => shift(-1)}
              aria-label="Previous"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="flex min-w-[150px] items-center justify-center gap-2 text-center text-sm font-semibold sm:min-w-[180px] sm:text-base">
              <CalendarDays className="text-primary h-4 w-4" /> {label}
            </div>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={() => shift(1)}
              aria-label="Next"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <Tabs value={view} onValueChange={(v) => setView(v)} className="ml-auto">
            <TabsList>
              <TabsTrigger value="month">Month</TabsTrigger>
              <TabsTrigger value="week">Week</TabsTrigger>
              <TabsTrigger value="year">Year</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {view === "month" && <MonthGrid cursor={cursor} byDate={byDate} />}
        {view === "week" && <WeekStrip cursor={cursor} byDate={byDate} />}
        {view === "year" && (
          <YearGrid
            year={cursor.getFullYear()}
            byDate={byDate}
            onPick={(m) => {
              setCursor(new Date(cursor.getFullYear(), m, 1));
              setView("month");
            }}
          />
        )}
      </CardContent>
    </Card>
  );
}

function DayCell({ date, items, muted }) {
  return (
    <div
      className={cn(
        "min-h-[64px] min-w-0 overflow-hidden rounded-lg border p-1 text-left sm:min-h-[92px] sm:p-2",
        items.length ? "border-primary/30 bg-primary/5" : "border-border",
        muted && "opacity-40",
      )}
    >
      <div className="text-xs font-semibold">{date.getDate()}</div>
      <div className="mt-1 space-y-1">
        {items.map((h) => (
          <div
            key={h.id + iso(date)}
            title={h.name}
            className={cn(
              "line-clamp-3 rounded border px-1 py-0.5 text-[9px] leading-tight break-words sm:px-1.5 sm:text-[10px]",
              typeTone(h.type),
            )}
          >
            {h.name}
          </div>
        ))}
      </div>
    </div>
  );
}

function MonthGrid({ cursor, byDate }) {
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const start = startOfWeek(first);
  const days = Array.from({ length: 42 }, (_, i) => addDays(start, i));

  return (
    <div>
      <div className="grid grid-cols-7 gap-1 pb-2 sm:gap-2">
        {DOW.map((d) => (
          <div
            key={d}
            className="text-muted-foreground text-center text-[10px] tracking-wider uppercase"
          >
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1 sm:gap-2">
        {days.map((d) => (
          <DayCell
            key={iso(d)}
            date={d}
            items={byDate.get(iso(d)) ?? []}
            muted={d.getMonth() !== cursor.getMonth()}
          />
        ))}
      </div>
    </div>
  );
}

function WeekStrip({ cursor, byDate }) {
  const start = startOfWeek(cursor);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  return (
    <div className="grid grid-cols-7 gap-1 sm:gap-2">
      {days.map((d, i) => (
        <div key={iso(d)} className="space-y-2">
          <div className="text-muted-foreground text-center text-[10px] tracking-wider uppercase">
            {DOW[i]}
          </div>
          <DayCell date={d} items={byDate.get(iso(d)) ?? []} />
        </div>
      ))}
    </div>
  );
}

function YearGrid({ year, byDate, onPick }) {
  const perMonth = MONTHS.map((_, m) => {
    const items = [];
    for (const [k, v] of byDate) {
      const d = parse(k);
      if (d.getFullYear() === year && d.getMonth() === m) {
        for (const h of v) if (!items.some((x) => x.id === h.id)) items.push(h);
      }
    }
    return items;
  });

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {MONTHS.map((m, i) => (
        <button
          key={m}
          onClick={() => onPick(i)}
          className="border-border hover:border-primary/40 hover:shadow-card rounded-xl border p-4 text-left transition"
        >
          <div className="flex items-center justify-between">
            <span className="font-semibold">{m}</span>
            <Badge variant="outline">{perMonth[i].length}</Badge>
          </div>
          <div className="mt-2 space-y-1">
            {perMonth[i].length === 0 && (
              <div className="text-muted-foreground text-xs">No holidays</div>
            )}
            {perMonth[i].map((h) => (
              <div key={h.id} className="text-muted-foreground truncate text-xs">
                {parse(h.from).getDate()} · {h.name}
              </div>
            ))}
          </div>
        </button>
      ))}
    </div>
  );
}

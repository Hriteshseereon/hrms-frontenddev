import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  LineChart,
  Line,
  AreaChart,
  Area,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "@/lib/router";
import { ArrowUpRight } from "lucide-react";

/** Seereon palette — emerald primary, gold accent, then muted tones. */
export const PALETTE = [
  "#0f766e",
  "#b8860b",
  "#14b8a6",
  "#d4a017",
  "#64748b",
  "#94a3b8",
  "#0e4f4a",
  "#cbd5e1",
];

const fmt = (v) =>
  Math.abs(v) >= 100000
    ? `${(v / 100000).toFixed(1)}L`
    : Math.abs(v) >= 1000
      ? `${(v / 1000).toFixed(0)}k`
      : String(v);
export const inrShort = (v) => `₹\u00A0${fmt(v)}`;

/** Theme tokens instead of recharts' white default — the tooltip was a white box with light text in dark mode. */
const TOOLTIP_STYLE = {
  fontSize: 12,
  borderRadius: 8,
  background: "var(--popover)",
  color: "var(--popover-foreground)",
  border: "1px solid var(--border)",
};

export function ChartCard({ title, subtitle, children, action, className, to }) {
  return (
    <Card className={`shadow-card ${className ?? ""}`}>
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 pb-2">
        <div>
          {to ? (
            <Link href={to} className="group inline-flex items-center gap-1">
              <CardTitle className="group-hover:text-primary text-base">{title}</CardTitle>
              <ArrowUpRight className="text-muted-foreground group-hover:text-primary h-3.5 w-3.5" />
            </Link>
          ) : (
            <CardTitle className="text-base">{title}</CardTitle>
          )}
          {subtitle && <div className="text-muted-foreground mt-0.5 text-xs">{subtitle}</div>}
        </div>
        {action ??
          (to ? (
            <Link href={to} className="text-primary text-xs whitespace-nowrap hover:underline">
              Open
            </Link>
          ) : null)}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

/**
 * @typedef {Object} Datum
 * @property {string} name
 * @property {number} value
 */

export function DonutChart({ data, height = 240, unit = "", money = false }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius="55%"
            outerRadius="80%"
            paddingAngle={2}
            stroke="transparent"
          >
            {data.map((_, i) => (
              <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(v, n) => [
              `${money ? inrShort(v) : v}${unit} (${total ? Math.round((v / total) * 100) : 0}%)`,
              n,
            ]}
            contentStyle={TOOLTIP_STYLE}
          />

          <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export function BarsChart({
  data,
  keys,
  height = 240,
  stacked = false,
  money = false,
  colors,
  horizontal = false,
}) {
  const pal = colors ?? PALETTE;
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout={horizontal ? "vertical" : "horizontal"}
          margin={{ top: 8, right: 8, left: horizontal ? 8 : -16, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          {horizontal ? (
            <>
              <XAxis
                type="number"
                tick={{ fontSize: 11 }}
                tickFormatter={money ? fmt : undefined}
              />

              <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={110} />
            </>
          ) : (
            <>
              <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={money ? fmt : undefined} />
            </>
          )}
          <Tooltip formatter={(v) => (money ? inrShort(v) : v)} contentStyle={TOOLTIP_STYLE} />

          {keys.length > 1 && <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />}
          {keys.map((k, i) => (
            <Bar
              key={k.key}
              dataKey={k.key}
              name={k.label}
              stackId={stacked ? "a" : undefined}
              fill={pal[i % pal.length]}
              radius={stacked && i < keys.length - 1 ? 0 : [4, 4, 0, 0]}
              maxBarSize={36}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function LinesChart({ data, keys, height = 240, money = false, area = false }) {
  const C = area ? AreaChart : LineChart;
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <C data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} tickFormatter={money ? fmt : undefined} />
          <Tooltip formatter={(v) => (money ? inrShort(v) : v)} contentStyle={TOOLTIP_STYLE} />

          {keys.length > 1 && <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />}
          {keys.map((k, i) =>
            area ? (
              <Area
                key={k.key}
                type="monotone"
                dataKey={k.key}
                name={k.label}
                stroke={PALETTE[i]}
                fill={PALETTE[i]}
                fillOpacity={0.15}
                strokeWidth={2}
              />
            ) : (
              <Line
                key={k.key}
                type="monotone"
                dataKey={k.key}
                name={k.label}
                stroke={PALETTE[i]}
                strokeWidth={2}
                dot={{ r: 3 }}
              />
            ),
          )}
        </C>
      </ResponsiveContainer>
    </div>
  );
}

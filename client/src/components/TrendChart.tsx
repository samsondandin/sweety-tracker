import React from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from 'recharts';
import { formatDate } from '../lib/glucose';

interface DataPoint {
  date: string;
  average: number | null;
  count: number;
}

interface TrendChartProps {
  data: DataPoint[];
  title?: string;
}

export function TrendChart({ data, title = 'Glucose Trend (Daily Average)' }: TrendChartProps) {
  const chartData = data
    .filter((d) => d.average !== null)
    .map((d) => ({
      ...d,
      displayDate: formatDate(d.date, { month: 'short', day: 'numeric' }),
      value: d.average
    }));

  if (chartData.length === 0) {
    return (
      <div className="flex h-56 flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card/40 p-6 text-center">
        <p className="text-sm font-medium text-foreground">No trend data available for this range</p>
        <p className="mt-1 text-xs text-muted-foreground">Add readings to visualize your glucose trajectory.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-xs">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="font-display text-lg text-foreground">{title}</h3>
          <p className="text-xs text-muted-foreground">Daily average blood glucose (mg/dL)</p>
        </div>
      </div>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
            <XAxis
              dataKey="displayDate"
              tickLine={false}
              axisLine={false}
              tick={{ fill: '#6b7280', fontSize: 11 }}
            />
            <YAxis
              domain={['dataMin - 15', 'dataMax + 15']}
              tickLine={false}
              axisLine={false}
              tick={{ fill: '#6b7280', fontSize: 11 }}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const item = payload[0].payload as DataPoint & { displayDate: string; value: number };
                  return (
                    <div className="rounded-md border border-border bg-background p-2.5 shadow-md">
                      <p className="text-xs font-medium text-foreground">{item.displayDate}</p>
                      <p className="mt-1 text-sm font-semibold text-primary">
                        {item.value} <span className="text-xs font-normal text-muted-foreground">mg/dL</span>
                      </p>
                      <p className="text-[11px] text-muted-foreground">{item.count} reading{item.count > 1 ? 's' : ''}</p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke="#197664"
              strokeWidth={2.5}
              dot={{ r: 3, fill: '#197664', strokeWidth: 0 }}
              activeDot={{ r: 5, fill: '#197664', stroke: '#fff', strokeWidth: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}


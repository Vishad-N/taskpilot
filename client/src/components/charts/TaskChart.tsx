"use client";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend
} from "recharts";

const COLORS = ["#10b981", "#f59e0b", "#6366f1"];
const LABELS = ["Completed", "Pending", "In Progress"];

function CustomLabel({ cx, cy, total, completed }: { cx: number; cy: number; total: number; completed: number }) {
  const pct = total === 0 ? 0 : Math.round((completed / total) * 100);
  return (
    <g>
      <text x={cx} y={cy - 10} textAnchor="middle" fill="var(--foreground)" fontSize={28} fontWeight={800}>
        {pct}%
      </text>
      <text x={cx} y={cy + 16} textAnchor="middle" fill="var(--muted)" fontSize={11} fontWeight={600} letterSpacing={2}>
        DONE
      </text>
    </g>
  );
}

function CustomTooltip({ active, payload }: any) {
  if (active && payload && payload.length) {
    const d = payload[0];
    return (
      <div style={{
        background: "var(--card)",
        border: "1px solid var(--card-border)",
        borderRadius: 14,
        padding: "10px 16px",
        backdropFilter: "blur(12px)",
        fontSize: 12,
        fontWeight: 700,
        color: "var(--foreground)"
      }}>
        <span style={{ color: d.payload.fill }}>{d.name}</span>
        <span style={{ marginLeft: 10, color: "var(--muted)" }}>{d.value} tasks</span>
      </div>
    );
  }
  return null;
}

export default function TaskChart({ data }: { data: any }) {
  const chartData = [
    { name: "Completed", value: data.completedTasks || 0, fill: COLORS[0] },
    { name: "Pending", value: data.pendingTasks || 0, fill: COLORS[1] },
    { name: "In Progress", value: data.inProgressTasks || 0, fill: COLORS[2] },
  ];
  const total = chartData.reduce((s, d) => s + d.value, 0);

  return (
    <div className="w-full h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            dataKey="value"
            innerRadius="62%"
            outerRadius="85%"
            paddingAngle={4}
            stroke="none"
            labelLine={false}
            label={({ cx, cy }) => (
              <CustomLabel cx={cx} cy={cy} total={total} completed={data.completedTasks || 0} />
            )}
          >
            {chartData.map((entry, i) => (
              <Cell key={i} fill={entry.fill} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend
            iconType="circle"
            iconSize={8}
            formatter={(value) => (
              <span style={{ color: "var(--muted)", fontSize: 11, fontWeight: 600, letterSpacing: 1 }}>
                {value.toUpperCase()}
              </span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

import { AmortizationRow, formatCurrency } from "@/lib/loanCalculations";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";

interface LoanChartProps {
  data: AmortizationRow[];
  totalPrincipal: number;
  totalInterest: number;
  currency: "NIO" | "USD";
}

const LoanChart = ({ data, totalPrincipal, totalInterest, currency }: LoanChartProps) => {
  if (data.length === 0) return null;

  const chartData = data.map((row) => ({
    paymentNumber: row.paymentNumber,
    Capital: row.principal,
    Interés: row.interest,
    Saldo: row.balance,
  }));

  const pieData = [
    { name: "Capital", value: totalPrincipal, color: "hsl(149, 100%, 29%)" },
    { name: "Intereses", value: totalInterest, color: "hsl(25, 90%, 56%)" },
  ];

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="rounded-lg border border-border bg-card p-3 shadow-lg">
          <p className="mb-2 font-semibold text-foreground">Cuota {label}</p>
          {payload.map((entry: any, index: number) => (
            <p
              key={index}
              className="text-sm"
              style={{ color: entry.color }}
            >
              {entry.name}: {formatCurrency(entry.value, currency)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Area Chart */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-md">
        <h3 className="mb-4 text-lg font-semibold text-foreground">
          Evolución del Crédito
        </h3>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorCapital" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(149, 100%, 29%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(149, 100%, 29%)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorInteres" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(25, 90%, 56%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(25, 90%, 56%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(213, 30%, 88%)" />
              <XAxis
                dataKey="paymentNumber"
                stroke="hsl(213, 30%, 45%)"
                fontSize={12}
                tickLine={false}
              />
              <YAxis
                stroke="hsl(213, 30%, 45%)"
                fontSize={12}
                tickLine={false}
                tickFormatter={(value) => formatCurrency(value, currency)}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Area
                type="monotone"
                dataKey="Capital"
                stroke="hsl(149, 100%, 29%)"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorCapital)"
              />
              <Area
                type="monotone"
                dataKey="Interés"
                stroke="hsl(25, 90%, 56%)"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorInteres)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Pie Chart */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-md">
        <h3 className="mb-4 text-lg font-semibold text-foreground">
          Distribución del Pago Total
        </h3>
        <div className="flex flex-col items-center gap-6 md:flex-row">
          <div className="h-[200px] w-full md:w-1/2">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) => formatCurrency(value, currency)}
                  contentStyle={{
                    backgroundColor: "hsl(0, 0%, 100%)",
                    border: "1px solid hsl(213, 30%, 88%)",
                    borderRadius: "0.5rem",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-4 md:w-1/2">
            {pieData.map((item) => (
              <div key={item.name} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="h-4 w-4 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="font-medium text-foreground">{item.name}</span>
                </div>
                <span className="font-semibold text-foreground">
                  {formatCurrency(item.value, currency)}
                </span>
              </div>
            ))}
            <div className="border-t border-border pt-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-foreground">Total</span>
                <span className="font-bold text-primary">
                  {formatCurrency(totalPrincipal + totalInterest, currency)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoanChart;

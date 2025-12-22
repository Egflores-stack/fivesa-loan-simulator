import { LoanSummary, formatCurrency, type PaymentFrequency } from "@/lib/loanCalculations";
import { TrendingUp, Wallet, Calculator, BadgeDollarSign } from "lucide-react";

interface LoanSummaryCardProps {
  summary: LoanSummary;
  currency: "NIO" | "USD";
  frequency: PaymentFrequency;
}

const frequencyLabel: Record<PaymentFrequency, string> = {
  monthly: "Mensual",
  biweekly: "Quincenal",
  weekly: "Semanal",
};

const LoanSummaryCard = ({ summary, currency, frequency }: LoanSummaryCardProps) => {
  const stats = [
    {
      label: `Cuota ${frequencyLabel[frequency]}`,
      value: formatCurrency(summary.paymentPerPeriod, currency),
      icon: Wallet,
      highlight: true,
      bgClass: "bg-accent",
      iconClass: "text-accent-foreground",
    },
    {
      label: "Monto a Financiar",
      value: formatCurrency(summary.effectiveAmount, currency),
      icon: BadgeDollarSign,
      highlight: false,
      bgClass: "bg-fivesa-blue-light",
      iconClass: "text-primary",
    },
    {
      label: "Total Comisión",
      value: formatCurrency(summary.totalCommission, currency),
      icon: Calculator,
      highlight: false,
      bgClass: "bg-fivesa-green-light",
      iconClass: "text-secondary",
    },
    {
      label: "Total de Intereses",
      value: formatCurrency(summary.totalInterest, currency),
      icon: TrendingUp,
      highlight: false,
      bgClass: "bg-fivesa-orange-light",
      iconClass: "text-accent",
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {stats.map((stat, index) => (
        <div
          key={stat.label}
          className={`animate-scale-in rounded-xl p-5 transition-all duration-300 hover:shadow-lg ${
            stat.highlight
              ? "bg-gradient-to-br from-accent to-accent/80 text-accent-foreground shadow-lg"
              : "bg-card shadow-md"
          }`}
          style={{ animationDelay: `${index * 100}ms` }}
        >
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p
                className={`text-sm font-medium ${
                  stat.highlight ? "text-accent-foreground/80" : "text-muted-foreground"
                }`}
              >
                {stat.label}
              </p>
              <p
                className={`text-2xl font-bold tracking-tight ${
                  stat.highlight ? "text-accent-foreground" : "text-foreground"
                }`}
              >
                {stat.value}
              </p>
            </div>
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                stat.highlight ? "bg-accent-foreground/20" : stat.bgClass
              }`}
            >
              <stat.icon
                className={`h-5 w-5 ${
                  stat.highlight ? "text-accent-foreground" : stat.iconClass
                }`}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default LoanSummaryCard;

import { LoanSummary, formatCurrency } from "@/lib/loanCalculations";
import { Check } from "lucide-react";

interface TermComparisonProps {
  comparisons: { term: number; summary: LoanSummary }[];
  selectedTerm: number;
  onSelectTerm: (term: number) => void;
}

const TermComparison = ({
  comparisons,
  selectedTerm,
  onSelectTerm,
}: TermComparisonProps) => {
  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-md">
      <h3 className="mb-4 text-lg font-semibold text-foreground">
        Comparar Plazos
      </h3>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {comparisons.map(({ term, summary }, index) => {
          const isSelected = term === selectedTerm;
          const isBestMonthly = comparisons.every(
            (c) => summary.monthlyPayment <= c.summary.monthlyPayment || c.term === term
          );
          const isBestTotal =
            summary.totalPayment ===
            Math.min(...comparisons.map((c) => c.summary.totalPayment));

          return (
            <button
              key={term}
              onClick={() => onSelectTerm(term)}
              className={`relative rounded-xl border-2 p-4 text-left transition-all duration-200 ${
                isSelected
                  ? "border-primary bg-fivesa-blue-light shadow-lg"
                  : "border-border bg-card hover:border-primary/50 hover:shadow-md"
              }`}
            >
              {isSelected && (
                <div className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Check className="h-4 w-4" />
                </div>
              )}
              <div className="mb-3 flex items-center gap-2">
                <span className="text-2xl font-bold text-primary">{term}</span>
                <span className="text-sm text-muted-foreground">meses</span>
              </div>
              <div className="space-y-2">
                <div>
                  <p className="text-xs text-muted-foreground">Pago Mensual</p>
                  <p className="text-lg font-semibold text-accent">
                    {formatCurrency(summary.monthlyPayment)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total a Pagar</p>
                  <p className="font-medium text-foreground">
                    {formatCurrency(summary.totalPayment)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Intereses</p>
                  <p className="text-sm text-muted-foreground">
                    {formatCurrency(summary.totalInterest)}
                  </p>
                </div>
              </div>
              {isBestTotal && term !== comparisons[0].term && (
                <span className="mt-2 inline-block rounded-full bg-secondary/10 px-2 py-0.5 text-xs font-medium text-secondary">
                  Menor costo total
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default TermComparison;

import { useState, useEffect } from "react";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency, formatPercent } from "@/lib/loanCalculations";
import { DollarSign, Calendar, Percent, PiggyBank } from "lucide-react";

interface LoanFormProps {
  amount: number;
  downPayment: number;
  termMonths: number;
  annualRate: number;
  onAmountChange: (value: number) => void;
  onDownPaymentChange: (value: number) => void;
  onTermChange: (value: number) => void;
  onRateChange: (value: number) => void;
}

const LoanForm = ({
  amount,
  downPayment,
  termMonths,
  annualRate,
  onAmountChange,
  onDownPaymentChange,
  onTermChange,
  onRateChange,
}: LoanFormProps) => {
  const minAmount = 5000;
  const maxAmount = 500000;
  const minTerm = 3;
  const maxTerm = 60;
  const minRate = 5;
  const maxRate = 40;

  const handleAmountInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value.replace(/[^0-9.]/g, "")) || 0;
    onAmountChange(Math.min(maxAmount, Math.max(0, value)));
  };

  const handleDownPaymentInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value.replace(/[^0-9.]/g, "")) || 0;
    onDownPaymentChange(Math.min(amount * 0.5, Math.max(0, value)));
  };

  return (
    <div className="space-y-8">
      {/* Loan Amount */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label className="flex items-center gap-2 text-base font-semibold text-foreground">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-fivesa-blue-light">
              <DollarSign className="h-4 w-4 text-primary" />
            </div>
            Monto del Crédito
          </Label>
          <div className="relative">
            <Input
              type="text"
              value={formatCurrency(amount).replace("$", "")}
              onChange={handleAmountInput}
              className="w-40 pr-2 text-right font-semibold"
            />
          </div>
        </div>
        <Slider
          value={[amount]}
          onValueChange={([val]) => onAmountChange(val)}
          min={minAmount}
          max={maxAmount}
          step={1000}
          className="py-2"
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{formatCurrency(minAmount)}</span>
          <span>{formatCurrency(maxAmount)}</span>
        </div>
      </div>

      {/* Down Payment */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label className="flex items-center gap-2 text-base font-semibold text-foreground">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-fivesa-green-light">
              <PiggyBank className="h-4 w-4 text-secondary" />
            </div>
            Enganche Inicial
          </Label>
          <div className="relative">
            <Input
              type="text"
              value={formatCurrency(downPayment).replace("$", "")}
              onChange={handleDownPaymentInput}
              className="w-40 pr-2 text-right font-semibold"
            />
          </div>
        </div>
        <Slider
          value={[downPayment]}
          onValueChange={([val]) => onDownPaymentChange(val)}
          min={0}
          max={amount * 0.5}
          step={500}
          className="py-2"
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{formatCurrency(0)}</span>
          <span>{formatCurrency(amount * 0.5)} (50%)</span>
        </div>
      </div>

      {/* Term */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label className="flex items-center gap-2 text-base font-semibold text-foreground">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-fivesa-orange-light">
              <Calendar className="h-4 w-4 text-accent" />
            </div>
            Plazo (meses)
          </Label>
          <span className="rounded-lg bg-muted px-4 py-2 font-semibold">
            {termMonths} meses
          </span>
        </div>
        <Slider
          value={[termMonths]}
          onValueChange={([val]) => onTermChange(val)}
          min={minTerm}
          max={maxTerm}
          step={1}
          className="py-2"
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{minTerm} meses</span>
          <span>{maxTerm} meses</span>
        </div>
      </div>

      {/* Interest Rate */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label className="flex items-center gap-2 text-base font-semibold text-foreground">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-fivesa-blue-light">
              <Percent className="h-4 w-4 text-primary" />
            </div>
            Tasa de Interés Anual
          </Label>
          <span className="rounded-lg bg-muted px-4 py-2 font-semibold">
            {formatPercent(annualRate)}
          </span>
        </div>
        <Slider
          value={[annualRate]}
          onValueChange={([val]) => onRateChange(val)}
          min={minRate}
          max={maxRate}
          step={0.5}
          className="py-2"
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{formatPercent(minRate)}</span>
          <span>{formatPercent(maxRate)}</span>
        </div>
      </div>
    </div>
  );
};

export default LoanForm;

import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency, formatPercent, type CommissionType, type PaymentFrequency } from "@/lib/loanCalculations";
import { Calendar, Percent, PiggyBank, BadgeDollarSign, Repeat, BadgePercent } from "lucide-react";

interface LoanFormProps {
  amount: number;
  downPayment: number;
  termMonths: number;
  monthlyRate: number;
  currency: "NIO" | "USD";
  frequency: PaymentFrequency;
  commissionType: CommissionType;
  commissionValue: number;
  onAmountChange: (value: number) => void;
  onDownPaymentChange: (value: number) => void;
  onTermChange: (value: number) => void;
  onRateChange: (value: number) => void;
  onCurrencyChange: (value: "NIO" | "USD") => void;
  onFrequencyChange: (value: PaymentFrequency) => void;
  onCommissionTypeChange: (value: CommissionType) => void;
  onCommissionValueChange: (value: number) => void;
}

const LoanForm = ({
  amount,
  downPayment,
  termMonths,
  monthlyRate,
  currency,
  frequency,
  commissionType,
  commissionValue,
  onAmountChange,
  onDownPaymentChange,
  onTermChange,
  onRateChange,
  onCurrencyChange,
  onFrequencyChange,
  onCommissionTypeChange,
  onCommissionValueChange,
}: LoanFormProps) => {
  const minAmount = 5000;
  const maxAmount = 500000;
  const minTerm = 3;
  const maxTerm = 60;
  const minRate = 1;
  const maxRate = 10;

  const handleAmountInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value.replace(/[^0-9.]/g, "")) || 0;
    onAmountChange(Math.min(maxAmount, Math.max(0, value)));
  };

  const handleDownPaymentInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value.replace(/[^0-9.]/g, "")) || 0;
    onDownPaymentChange(Math.min(amount * 0.5, Math.max(0, value)));
  };

  const handleCommissionInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value.replace(/[^0-9.]/g, "")) || 0;
    onCommissionValueChange(Math.max(0, value));
  };

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label className="flex items-center gap-2 text-base font-semibold text-foreground">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-fivesa-blue-light">
              <BadgeDollarSign className="h-4 w-4 text-primary" />
            </div>
            Moneda
          </Label>
          <Select value={currency} onValueChange={(value) => onCurrencyChange(value as "NIO" | "USD")}
          >
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Selecciona" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="NIO">Córdoba (NIO)</SelectItem>
              <SelectItem value="USD">Dólar (USD)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Loan Amount */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label className="flex items-center gap-2 text-base font-semibold text-foreground">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-fivesa-blue-light">
              <BadgeDollarSign className="h-4 w-4 text-primary" />
            </div>
            Monto del Crédito
          </Label>
          <div className="relative">
            <Input
              type="text"
              value={formatCurrency(amount, currency).replace(/[A-Z$]/g, "").trim()}
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
          <span>{formatCurrency(minAmount, currency)}</span>
          <span>{formatCurrency(maxAmount, currency)}</span>
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
              value={formatCurrency(downPayment, currency).replace(/[A-Z$]/g, "").trim()}
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
          <span>{formatCurrency(0, currency)}</span>
          <span>{formatCurrency(amount * 0.5, currency)} (50%)</span>
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

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label className="flex items-center gap-2 text-base font-semibold text-foreground">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-fivesa-blue-light">
              <Repeat className="h-4 w-4 text-primary" />
            </div>
            Frecuencia de pago
          </Label>
          <Select value={frequency} onValueChange={(value) => onFrequencyChange(value as PaymentFrequency)}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Selecciona" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="monthly">Mensual</SelectItem>
              <SelectItem value="biweekly">Quincenal</SelectItem>
              <SelectItem value="weekly">Semanal</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Interest Rate */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label className="flex items-center gap-2 text-base font-semibold text-foreground">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-fivesa-blue-light">
              <Percent className="h-4 w-4 text-primary" />
            </div>
            Interés Mensual
          </Label>
          <span className="rounded-lg bg-muted px-4 py-2 font-semibold">
            {formatPercent(monthlyRate)}
          </span>
        </div>
        <Slider
          value={[monthlyRate]}
          onValueChange={([val]) => onRateChange(val)}
          min={minRate}
          max={maxRate}
          step={0.1}
          className="py-2"
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{formatPercent(minRate)}</span>
          <span>{formatPercent(maxRate)}</span>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label className="flex items-center gap-2 text-base font-semibold text-foreground">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-fivesa-green-light">
              <BadgePercent className="h-4 w-4 text-secondary" />
            </div>
            Tipo de comisión
          </Label>
          <Select value={commissionType} onValueChange={(value) => onCommissionTypeChange(value as CommissionType)}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Selecciona" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="percentage">Porcentaje</SelectItem>
              <SelectItem value="amount">Monto</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center justify-between">
          <Label className="text-sm text-muted-foreground">
            Comisión ({commissionType === "percentage" ? "%" : currency})
          </Label>
          <Input
            type="text"
            value={commissionValue}
            onChange={handleCommissionInput}
            className="w-40 pr-2 text-right font-semibold"
          />
        </div>
      </div>
    </div>
  );
};

export default LoanForm;

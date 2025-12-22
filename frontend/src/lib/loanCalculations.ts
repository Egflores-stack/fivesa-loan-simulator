export type PaymentFrequency = "monthly" | "biweekly" | "weekly";
export type CommissionType = "percentage" | "amount";

export interface LoanParams {
  amount: number;
  downPayment: number;
  termMonths: number;
  monthlyRate: number;
  frequency: PaymentFrequency;
  commissionType: CommissionType;
  commissionValue: number;
}

export interface AmortizationRow {
  paymentNumber: number;
  payment: number;
  principal: number;
  interest: number;
  commission: number;
  balance: number;
}

export interface LoanSummary {
  loanAmount: number;
  paymentPerPeriod: number;
  totalPayment: number;
  totalInterest: number;
  totalCommission: number;
  effectiveAmount: number;
  numberOfPayments: number;
  periodicRate: number;
}

const frequencyDivisors: Record<PaymentFrequency, number> = {
  monthly: 1,
  biweekly: 2,
  weekly: 4,
};

export function calculateLoan(params: LoanParams): LoanSummary {
  const {
    amount,
    downPayment,
    termMonths,
    monthlyRate,
    frequency,
    commissionType,
    commissionValue,
  } = params;
  const effectiveAmount = amount - downPayment;

  if (effectiveAmount <= 0 || termMonths <= 0) {
    return {
      loanAmount: amount,
      paymentPerPeriod: 0,
      totalPayment: 0,
      totalInterest: 0,
      totalCommission: 0,
      effectiveAmount: 0,
      numberOfPayments: 0,
      periodicRate: 0,
    };
  }

  const divisor = frequencyDivisors[frequency];
  const numberOfPayments = termMonths * divisor;
  const periodicRate = monthlyRate / 100 / divisor;

  let basePayment: number;
  if (periodicRate === 0) {
    basePayment = effectiveAmount / numberOfPayments;
  } else {
    basePayment =
      (effectiveAmount * periodicRate * Math.pow(1 + periodicRate, numberOfPayments)) /
      (Math.pow(1 + periodicRate, numberOfPayments) - 1);
  }

  const totalCommission =
    commissionType === "percentage"
      ? (effectiveAmount * commissionValue) / 100
      : commissionValue;
  const commissionPerPayment = numberOfPayments > 0 ? totalCommission / numberOfPayments : 0;

  const totalInterest = basePayment * numberOfPayments - effectiveAmount;
  const paymentPerPeriod = basePayment + commissionPerPayment;
  const totalPayment =
    paymentPerPeriod * numberOfPayments + downPayment;

  return {
    loanAmount: amount,
    paymentPerPeriod,
    totalPayment,
    totalInterest,
    totalCommission,
    effectiveAmount,
    numberOfPayments,
    periodicRate,
  };
}

export function generateAmortizationTable(params: LoanParams): AmortizationRow[] {
  const {
    amount,
    downPayment,
    termMonths,
    monthlyRate,
    frequency,
    commissionType,
    commissionValue,
  } = params;
  const effectiveAmount = amount - downPayment;

  if (effectiveAmount <= 0 || termMonths <= 0) {
    return [];
  }

  const divisor = frequencyDivisors[frequency];
  const numberOfPayments = termMonths * divisor;
  const periodicRate = monthlyRate / 100 / divisor;
  const summary = calculateLoan(params);
  const table: AmortizationRow[] = [];
  let balance = effectiveAmount;

  const commissionTotal =
    commissionType === "percentage"
      ? (effectiveAmount * commissionValue) / 100
      : commissionValue;
  const commissionPerPayment = numberOfPayments > 0 ? commissionTotal / numberOfPayments : 0;

  const basePayment = summary.paymentPerPeriod - commissionPerPayment;

  for (let paymentNumber = 1; paymentNumber <= numberOfPayments; paymentNumber += 1) {
    const interest = balance * periodicRate;
    const principal = basePayment - interest;
    balance = Math.max(0, balance - principal);

    table.push({
      paymentNumber,
      payment: summary.paymentPerPeriod,
      principal,
      interest,
      commission: commissionPerPayment,
      balance,
    });
  }

  return table;
}

export function compareTerms(
  amount: number,
  downPayment: number,
  monthlyRate: number,
  frequency: PaymentFrequency,
  commissionType: CommissionType,
  commissionValue: number,
  terms: number[]
): { term: number; summary: LoanSummary }[] {
  return terms.map((term) => ({
    term,
    summary: calculateLoan({
      amount,
      downPayment,
      termMonths: term,
      monthlyRate,
      frequency,
      commissionType,
      commissionValue,
    }),
  }));
}

export function formatCurrency(value: number, currency = "NIO"): string {
  const locale = currency === "USD" ? "en-US" : "es-NI";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatPercent(value: number): string {
  return `${value.toFixed(2)}%`;
}

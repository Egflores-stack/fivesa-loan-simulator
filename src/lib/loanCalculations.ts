export interface LoanParams {
  amount: number;
  downPayment: number;
  termMonths: number;
  annualRate: number;
}

export interface AmortizationRow {
  month: number;
  payment: number;
  principal: number;
  interest: number;
  balance: number;
}

export interface LoanSummary {
  loanAmount: number;
  monthlyPayment: number;
  totalPayment: number;
  totalInterest: number;
  effectiveAmount: number;
}

export function calculateLoan(params: LoanParams): LoanSummary {
  const { amount, downPayment, termMonths, annualRate } = params;
  const effectiveAmount = amount - downPayment;
  
  if (effectiveAmount <= 0 || termMonths <= 0) {
    return {
      loanAmount: amount,
      monthlyPayment: 0,
      totalPayment: 0,
      totalInterest: 0,
      effectiveAmount: 0,
    };
  }

  const monthlyRate = annualRate / 100 / 12;
  
  let monthlyPayment: number;
  if (monthlyRate === 0) {
    monthlyPayment = effectiveAmount / termMonths;
  } else {
    monthlyPayment =
      (effectiveAmount * monthlyRate * Math.pow(1 + monthlyRate, termMonths)) /
      (Math.pow(1 + monthlyRate, termMonths) - 1);
  }

  const totalPayment = monthlyPayment * termMonths + downPayment;
  const totalInterest = totalPayment - amount;

  return {
    loanAmount: amount,
    monthlyPayment,
    totalPayment,
    totalInterest,
    effectiveAmount,
  };
}

export function generateAmortizationTable(params: LoanParams): AmortizationRow[] {
  const { amount, downPayment, termMonths, annualRate } = params;
  const effectiveAmount = amount - downPayment;
  
  if (effectiveAmount <= 0 || termMonths <= 0) {
    return [];
  }

  const monthlyRate = annualRate / 100 / 12;
  const summary = calculateLoan(params);
  const table: AmortizationRow[] = [];
  
  let balance = effectiveAmount;

  for (let month = 1; month <= termMonths; month++) {
    const interest = balance * monthlyRate;
    const principal = summary.monthlyPayment - interest;
    balance = Math.max(0, balance - principal);

    table.push({
      month,
      payment: summary.monthlyPayment,
      principal,
      interest,
      balance,
    });
  }

  return table;
}

export function compareTerms(
  amount: number,
  downPayment: number,
  annualRate: number,
  terms: number[]
): { term: number; summary: LoanSummary }[] {
  return terms.map((term) => ({
    term,
    summary: calculateLoan({ amount, downPayment, termMonths: term, annualRate }),
  }));
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatPercent(value: number): string {
  return `${value.toFixed(2)}%`;
}

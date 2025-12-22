import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useState, useMemo } from "react";
import Header from "@/components/Header";
import LoanForm from "@/components/LoanForm";
import LoanSummaryCard from "@/components/LoanSummaryCard";
import AmortizationTable from "@/components/AmortizationTable";
import LoanChart from "@/components/LoanChart";
import TermComparison from "@/components/TermComparison";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  calculateLoan,
  compareTerms,
  generateAmortizationTable,
  type CommissionType,
  type PaymentFrequency,
} from "@/lib/loanCalculations";
import { BarChart3, Calculator, GitCompare, Table } from "lucide-react";

const Simulator = () => {
  const [amount, setAmount] = useState(100000);
  const [downPayment, setDownPayment] = useState(10000);
  const [termMonths, setTermMonths] = useState(24);
  const [monthlyRate, setMonthlyRate] = useState(3.5);
  const [currency, setCurrency] = useState<"NIO" | "USD">("NIO");
  const [frequency, setFrequency] = useState<PaymentFrequency>("monthly");
  const [commissionType, setCommissionType] = useState<CommissionType>(
    "percentage"
  );
  const [commissionValue, setCommissionValue] = useState(2);

  const summary = useMemo(
    () =>
      calculateLoan({
        amount,
        downPayment,
        termMonths,
        monthlyRate,
        frequency,
        commissionType,
        commissionValue,
      }),
    [
      amount,
      downPayment,
      termMonths,
      monthlyRate,
      frequency,
      commissionType,
      commissionValue,
    ]
  );

  const amortization = useMemo(
    () =>
      generateAmortizationTable({
        amount,
        downPayment,
        termMonths,
        monthlyRate,
        frequency,
        commissionType,
        commissionValue,
      }),
    [
      amount,
      downPayment,
      termMonths,
      monthlyRate,
      frequency,
      commissionType,
      commissionValue,
    ]
  );

  const termComparisons = useMemo(
    () =>
      compareTerms(
        amount,
        downPayment,
        monthlyRate,
        frequency,
        commissionType,
        commissionValue,
        [12, 24, 36, 48]
      ),
    [
      amount,
      downPayment,
      monthlyRate,
      frequency,
      commissionType,
      commissionValue,
    ]
  );

import ControlSummaryTable from "@/components/ControlSummaryTable";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  calculateLoan,
  generateAmortizationTable,
  compareTerms,
} from "@/lib/loanCalculations";
import {
  buildControlSummaryRows,
  buildReportCsv,
  buildReportPdfHtml,
  downloadCsv,
  openReportPdf,
} from "@/lib/reporting";
import {
  BarChart3,
  Calculator,
  FileDown,
  FileText,
  GitCompare,
  Table,
} from "lucide-react";

const Index = () => {
  const [amount, setAmount] = useState(100000);
  const [downPayment, setDownPayment] = useState(10000);
  const [termMonths, setTermMonths] = useState(24);
  const [annualRate, setAnnualRate] = useState(18);

  const summary = useMemo(
    () => calculateLoan({ amount, downPayment, termMonths, annualRate }),
    [amount, downPayment, termMonths, annualRate]
  );

  const amortization = useMemo(
    () => generateAmortizationTable({ amount, downPayment, termMonths, annualRate }),
    [amount, downPayment, termMonths, annualRate]
  );

  const termComparisons = useMemo(
    () => compareTerms(amount, downPayment, annualRate, [12, 24, 36, 48]),
    [amount, downPayment, annualRate]
  );

  const controlRows = useMemo(
    () =>
      buildControlSummaryRows({
        amount,
        downPayment,
        termMonths,
        annualRate,
        summary,
      }),
    [amount, downPayment, termMonths, annualRate, summary]
  );

  const handleExportCsv = () => {
    const csv = buildReportCsv({ rows: controlRows, amortization });
    downloadCsv(csv, `reporte-credito-${termMonths}m.csv`);
  };

  const handleExportPdf = () => {
    const html = buildReportPdfHtml({ rows: controlRows, amortization });
    openReportPdf(html);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="border-b border-border bg-card/70">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <p className="text-sm text-muted-foreground">
            Panel / Simulador de crédito
          </p>
          <Button asChild variant="ghost" size="sm">
            <Link to="/dashboard">Volver al dashboard</Link>
          </Button>
        </div>
      </div>

      
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary via-primary to-secondary py-16 text-primary-foreground">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%3E%3Cg%20fill%3D%22none%22%20fill-rule%3D%22evenodd%22%3E%3Cg%20fill%3D%22%23ffffff%22%20fill-opacity%3D%220.05%22%3E%3Cpath%20d%3D%22M36%2034v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6%2034v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6%204V0H4v4H0v2h4v4h2V6h4V4H6z%22/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] opacity-50" />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="animate-fade-in text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
              Simulador de Crédito
            </h1>
            <p className="mx-auto mt-4 max-w-2xl animate-slide-up text-lg text-primary-foreground/80">
              Calcula tu préstamo personal de manera rápida y sencilla.
              Conoce tu cuota según la frecuencia de pago y comisiones.
              Calcula tu préstamo personal de manera rápida y sencilla. 
              Conoce tu pago mensual y explora diferentes opciones de plazo.
            </p>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-5">
          {/* Form Section */}
          <div className="lg:col-span-2">
            <div className="sticky top-24 rounded-2xl border border-border bg-card p-6 shadow-lg">
              <div className="mb-6 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary">
                  <Calculator className="h-5 w-5 text-primary-foreground" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-foreground">
                    Configura tu Crédito
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Ajusta los valores según tus necesidades
                  </p>
                </div>
              </div>
              <LoanForm
                amount={amount}
                downPayment={downPayment}
                termMonths={termMonths}
                monthlyRate={monthlyRate}
                currency={currency}
                frequency={frequency}
                commissionType={commissionType}
                commissionValue={commissionValue}
                onAmountChange={setAmount}
                onDownPaymentChange={setDownPayment}
                onTermChange={setTermMonths}
                onRateChange={setMonthlyRate}
                onCurrencyChange={setCurrency}
                onFrequencyChange={setFrequency}
                onCommissionTypeChange={setCommissionType}
                onCommissionValueChange={setCommissionValue}
                annualRate={annualRate}
                onAmountChange={setAmount}
                onDownPaymentChange={setDownPayment}
                onTermChange={setTermMonths}
                onRateChange={setAnnualRate}
              />
              <div className="mt-8">
                <Button variant="accent" size="xl" className="w-full">
                  Solicitar Crédito
                </Button>
              </div>
            </div>
          </div>

          {/* Results Section */}
          <div className="space-y-8 lg:col-span-3">
            {/* Summary Cards */}
            <LoanSummaryCard summary={summary} currency={currency} frequency={frequency} />
            <Card className="border-dashed">
              <CardHeader>
                <CardTitle className="text-lg">Exportación</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-3">
                <Button variant="secondary" onClick={handleExportCsv}>
                  <FileDown className="mr-2 h-4 w-4" />
                  Exportar CSV
                </Button>
                <Button variant="outline" onClick={handleExportPdf}>
                  <FileText className="mr-2 h-4 w-4" />
                  Exportar PDF
                </Button>
              </CardContent>
            </Card>
            {/* Summary Cards */}
            <LoanSummaryCard summary={summary} />

            <ControlSummaryTable rows={controlRows} />

            {/* Tabs for detailed info */}
            <Tabs defaultValue="comparison" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="comparison" className="gap-2">
                  <GitCompare className="h-4 w-4" />
                  <span className="hidden sm:inline">Comparar</span>
                </TabsTrigger>
                <TabsTrigger value="table" className="gap-2">
                  <Table className="h-4 w-4" />
                  <span className="hidden sm:inline">Amortización</span>
                </TabsTrigger>
                <TabsTrigger value="charts" className="gap-2">
                  <BarChart3 className="h-4 w-4" />
                  <span className="hidden sm:inline">Gráficos</span>
                </TabsTrigger>
              </TabsList>
              <TabsContent value="comparison" className="mt-6">
                <TermComparison
                  comparisons={termComparisons}
                  selectedTerm={termMonths}
                  onSelectTerm={setTermMonths}
                  currency={currency}
                />
              </TabsContent>
              <TabsContent value="table" className="mt-6">
                <AmortizationTable data={amortization} currency={currency} />
                />
              </TabsContent>
              <TabsContent value="table" className="mt-6">
                <AmortizationTable data={amortization} />
              </TabsContent>
              <TabsContent value="charts" className="mt-6">
                <LoanChart
                  data={amortization}
                  totalPrincipal={summary.effectiveAmount}
                  totalInterest={summary.totalInterest}
                  currency={currency}
                />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-card py-8">
        <div className="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
          <p className="text-sm text-muted-foreground">
            © 2024 FIVESA. Todos los derechos reservados.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            * Este simulador es solo una referencia. Las condiciones finales del crédito
            * Este simulador es solo una referencia. Las condiciones finales del crédito 
            pueden variar según tu perfil crediticio y las políticas vigentes.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Simulator;
export default Index;

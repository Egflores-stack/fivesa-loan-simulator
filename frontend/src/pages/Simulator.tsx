import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import Header from "@/components/Header";
import LoanForm from "@/components/LoanForm";
import LoanSummaryCard from "@/components/LoanSummaryCard";
import AmortizationTable from "@/components/AmortizationTable";
import LoanChart from "@/components/LoanChart";
import TermComparison from "@/components/TermComparison";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  calculateLoan,
  compareTerms,
  generateAmortizationTable,
  type CommissionType,
  type PaymentFrequency,
} from "@/lib/loanCalculations";
import { createLoan } from "@/lib/dashboardApi";
import { toast } from "@/hooks/use-toast";
import { BarChart3, Calculator, GitCompare, Table } from "lucide-react";

const Simulator = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [showClientDialog, setShowClientDialog] = useState(false);
  const [amount, setAmount] = useState(100000);
  const [downPayment, setDownPayment] = useState(10000);
  const [termMonths, setTermMonths] = useState(24);
  const [monthlyRate, setMonthlyRate] = useState(3.5);
  const [currency, setCurrency] = useState<"NIO" | "USD">("NIO");
  const [frequency, setFrequency] = useState<PaymentFrequency>("monthly");
  const [commissionType, setCommissionType] = useState<CommissionType>("percentage");
  const [commissionValue, setCommissionValue] = useState(2);
  const [clientData, setClientData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    dpi: '',
    monthly_income: '',
    loan_purpose: ''
  });

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
    [amount, downPayment, termMonths, monthlyRate, frequency, commissionType, commissionValue]
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
    [amount, downPayment, termMonths, monthlyRate, frequency, commissionType, commissionValue]
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
    [amount, downPayment, monthlyRate, frequency, commissionType, commissionValue]
  );

  const handleLoanRequest = async () => {
    if (!user) {
      toast({
        title: "Error",
        description: "Debes estar autenticado para solicitar un crédito",
        variant: "destructive",
      });
      navigate('/login');
      return;
    }

    // Verificar si tenemos datos del cliente
    if (!clientData.first_name || !clientData.last_name || !clientData.email) {
      setShowClientDialog(true);
      return;
    }

    await submitLoanRequest();
  };

  const submitLoanRequest = async () => {
    try {
      setLoading(true);
      
      // Primero crear el cliente
      const clientResponse = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/clients`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({
          first_name: clientData.first_name,
          last_name: clientData.last_name,
          email: clientData.email,
          phone: clientData.phone,
          dpi: clientData.dpi,
          monthly_income: parseFloat(clientData.monthly_income) || 0,
          employment_status: 'employed'
        })
      });

      if (!clientResponse.ok) {
        throw new Error('Error al crear el cliente');
      }

      const clientResult = await clientResponse.json();
      
      // Luego crear la solicitud de préstamo
      const loanData = {
        clientId: clientResult.client?.id || 1, // Usar cliente creado o ID por defecto
        loanType: 'personal',
        amountRequested: amount,
        downPayment: downPayment,
        termMonths: termMonths,
        annualInterestRate: monthlyRate * 12,
        monthlyPayment: summary.payment,
        commissionType: commissionType,
        commissionValue: commissionValue,
        paymentFrequency: frequency,
        currency: currency,
        purpose: clientData.loan_purpose || 'Solicitud de crédito personal'
      };

      const loanResponse = await createLoan(loanData);

      toast({
        title: "¡Solicitud Enviada!",
        description: "Tu solicitud de crédito ha sido enviada exitosamente y está pendiente de aprobación.",
      });

      // Resetear formulario
      setClientData({
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        dpi: '',
        monthly_income: '',
        loan_purpose: ''
      });
      setShowClientDialog(false);
      
    } catch (error) {
      console.error('Error en solicitud:', error);
      toast({
        title: "Error",
        description: "No se pudo procesar tu solicitud. Por favor intenta nuevamente.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
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
            </p>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-5">
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
              />
              <div className="mt-8">
                <Button 
                  variant="accent" 
                  size="xl" 
                  className="w-full"
                  onClick={handleLoanRequest}
                  disabled={loading}
                >
                  {loading ? 'Procesando...' : 'Solicitar Crédito'}
                </Button>
              </div>
            </div>
          </div>

          <div className="space-y-8 lg:col-span-3">
            <LoanSummaryCard summary={summary} currency={currency} frequency={frequency} />

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

      <footer className="border-t border-border bg-card py-8">
        <div className="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
          <p className="text-sm text-muted-foreground">
            © 2024 FIVESA. Todos los derechos reservados.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            * Este simulador es solo una referencia. Las condiciones finales del crédito
            pueden variar según tu perfil crediticio y las políticas vigentes.
          </p>
        </div>
      </footer>

      {/* Dialog para datos del cliente */}
      <Dialog open={showClientDialog} onOpenChange={setShowClientDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Completa tus datos para continuar</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="first_name">Nombre</Label>
                <Input
                  id="first_name"
                  value={clientData.first_name}
                  onChange={(e) => setClientData(prev => ({ ...prev, first_name: e.target.value }))}
                  placeholder="Juan"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="last_name">Apellido</Label>
                <Input
                  id="last_name"
                  value={clientData.last_name}
                  onChange={(e) => setClientData(prev => ({ ...prev, last_name: e.target.value }))}
                  placeholder="Pérez"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={clientData.email}
                onChange={(e) => setClientData(prev => ({ ...prev, email: e.target.value }))}
                placeholder="juan.perez@email.com"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="phone">Teléfono</Label>
              <Input
                id="phone"
                value={clientData.phone}
                onChange={(e) => setClientData(prev => ({ ...prev, phone: e.target.value }))}
                placeholder="5555-1234"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="dpi">DPI/Cédula</Label>
              <Input
                id="dpi"
                value={clientData.dpi}
                onChange={(e) => setClientData(prev => ({ ...prev, dpi: e.target.value }))}
                placeholder="1234567890101"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="monthly_income">Ingreso Mensual (C$)</Label>
              <Input
                id="monthly_income"
                type="number"
                value={clientData.monthly_income}
                onChange={(e) => setClientData(prev => ({ ...prev, monthly_income: e.target.value }))}
                placeholder="15000"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="loan_purpose">Propósito del Préstamo</Label>
              <Textarea
                id="loan_purpose"
                value={clientData.loan_purpose}
                onChange={(e) => setClientData(prev => ({ ...prev, loan_purpose: e.target.value }))}
                placeholder="Describe para qué necesitas el crédito..."
                rows={3}
              />
            </div>
          </div>
          
          <div className="flex justify-end space-x-2">
            <Button 
              variant="outline" 
              onClick={() => setShowClientDialog(false)}
            >
              Cancelar
            </Button>
            <Button 
              onClick={submitLoanRequest}
              disabled={loading || !clientData.first_name || !clientData.last_name || !clientData.email}
            >
              {loading ? 'Procesando...' : 'Enviar Solicitud'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Simulator;

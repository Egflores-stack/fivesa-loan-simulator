import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Header from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from '@/hooks/use-toast';
import { calculateLoan, createLoan, getClients } from '@/lib/dashboardApi';

interface ClientOption {
  id: number;
  full_name?: string;
  nombres?: string;
  apellidos?: string;
  identificacion?: string;
}

interface AmortizationRow {
  numeroCuota: number;
  fechaVencimiento: string;
  capital: number;
  interes: number;
  seguroVida: number;
  seguroDanos: number;
  cuotaTotal: number;
  saldoCapital: number;
}

interface SimulationResponse {
  calculation: {
    montoSolicitado: number;
    tasaInteresAnual: number;
    plazoMeses: number;
    cuotaReferencial: number;
    totalComision: number;
    totalCapital: number;
    totalInteres: number;
    totalSeguroVida: number;
    totalSeguroDanos: number;
    totalCuotas: number;
  };
  rates: {
    seguroVidaPct: number;
    seguroDanosPct: number;
    comisionPct: number;
  };
  amortization: AmortizationRow[];
}

const currencyFormatter = new Intl.NumberFormat('es-NI', {
  style: 'currency',
  currency: 'NIO',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const Simulator = () => {
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [clientId, setClientId] = useState('');
  const [amount, setAmount] = useState(50000);
  const [termMonths, setTermMonths] = useState(24);
  const [annualRate, setAnnualRate] = useState(24);
  const [loanType, setLoanType] = useState('PERSONAL');
  const [destino, setDestino] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [simulation, setSimulation] = useState<SimulationResponse | null>(null);
  const [loadingSimulation, setLoadingSimulation] = useState(false);
  const [loadingSubmit, setLoadingSubmit] = useState(false);

  useEffect(() => {
    const loadClients = async () => {
      try {
        const response = await getClients();
        setClients(response.clients || []);
      } catch (error) {
        console.error('Error cargando clientes:', error);
        toast({
          title: 'Error',
          description: 'No se pudo cargar la lista de clientes',
          variant: 'destructive',
        });
      }
    };

    loadClients();
  }, []);

  useEffect(() => {
    const timeout = setTimeout(async () => {
      try {
        setLoadingSimulation(true);
        const response = (await calculateLoan({
          monto_solicitado: amount,
          plazo_meses: termMonths,
          tasa_interes: annualRate,
        })) as SimulationResponse;
        setSimulation(response);
      } catch (error) {
        console.error('Error calculando credito:', error);
      } finally {
        setLoadingSimulation(false);
      }
    }, 350);

    return () => clearTimeout(timeout);
  }, [amount, termMonths, annualRate]);

  const firstInstallment = simulation?.amortization?.[0] ?? null;

  const canSubmit = useMemo(
    () => Number(clientId) > 0 && amount > 0 && termMonths > 0 && annualRate >= 0,
    [clientId, amount, termMonths, annualRate],
  );

  const submitRequest = async () => {
    if (!canSubmit) {
      toast({
        title: 'Datos incompletos',
        description: 'Selecciona cliente y valida monto/plazo/tasa',
        variant: 'destructive',
      });
      return;
    }

    try {
      setLoadingSubmit(true);
      await createLoan({
        cliente_id: Number(clientId),
        monto_solicitado: amount,
        plazo_meses: termMonths,
        tasa_interes: annualRate,
        tipo_credito: loanType,
        destino: destino || null,
        observaciones: observaciones || null,
      });

      toast({
        title: 'Solicitud creada',
        description: 'La solicitud de credito fue registrada en estado PENDIENTE',
      });

      setDestino('');
      setObservaciones('');
    } catch (error) {
      console.error('Error creando solicitud:', error);
      toast({
        title: 'Error',
        description: 'No se pudo registrar la solicitud de credito',
        variant: 'destructive',
      });
    } finally {
      setLoadingSubmit(false);
    }
  };

  const clientLabel = (client: ClientOption) => {
    const fullName =
      client.full_name || `${client.nombres ?? ''} ${client.apellidos ?? ''}`.trim();
    const idNumber = client.identificacion ? ` - ${client.identificacion}` : '';
    return `${fullName}${idNumber}`;
  };

  return (
    <div className="min-h-screen bg-muted/20">
      <Header />

      <div className="border-b border-border bg-card/60">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <p className="text-sm text-muted-foreground">Panel / Simulador de credito</p>
          <Button asChild variant="ghost" size="sm">
            <Link to="/dashboard">Volver al dashboard</Link>
          </Button>
        </div>
      </div>

      <main className="mx-auto grid max-w-7xl gap-6 px-4 py-8 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Nueva Solicitud</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>Cliente</Label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un cliente" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={String(client.id)}>
                      {clientLabel(client)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Monto a financiar</Label>
                <span className="text-sm font-medium">{currencyFormatter.format(amount)}</span>
              </div>
              <Slider
                value={[amount]}
                onValueChange={([v]) => setAmount(v)}
                min={5000}
                max={300000}
                step={1000}
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Plazo (meses)</Label>
                <span className="text-sm font-medium">{termMonths}</span>
              </div>
              <Slider
                value={[termMonths]}
                onValueChange={([v]) => setTermMonths(v)}
                min={3}
                max={72}
                step={1}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="annualRate">Tasa anual (%)</Label>
              <Input
                id="annualRate"
                type="number"
                value={annualRate}
                onChange={(event) => setAnnualRate(Number(event.target.value) || 0)}
              />
            </div>

            <div className="space-y-2">
              <Label>Tipo de credito</Label>
              <Select value={loanType} onValueChange={setLoanType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PERSONAL">PERSONAL</SelectItem>
                  <SelectItem value="COMERCIAL">COMERCIAL</SelectItem>
                  <SelectItem value="HIPOTECARIO">HIPOTECARIO</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="destino">Destino</Label>
              <Input
                id="destino"
                value={destino}
                onChange={(event) => setDestino(event.target.value)}
                placeholder="Compra de inventario, capital de trabajo, etc."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="observaciones">Observaciones</Label>
              <Input
                id="observaciones"
                value={observaciones}
                onChange={(event) => setObservaciones(event.target.value)}
                placeholder="Notas adicionales"
              />
            </div>

            <Button className="w-full" onClick={submitRequest} disabled={!canSubmit || loadingSubmit}>
              {loadingSubmit ? 'Guardando...' : 'Registrar Solicitud'}
            </Button>
          </CardContent>
        </Card>

        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Desglose Real de Cuota</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingSimulation ? (
                <p className="text-sm text-muted-foreground">Calculando...</p>
              ) : !firstInstallment ? (
                <p className="text-sm text-muted-foreground">Sin datos para mostrar.</p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">Capital</p>
                    <p className="text-lg font-semibold">{currencyFormatter.format(firstInstallment.capital)}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">Interes</p>
                    <p className="text-lg font-semibold">{currencyFormatter.format(firstInstallment.interes)}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">Seguro de vida</p>
                    <p className="text-lg font-semibold">{currencyFormatter.format(firstInstallment.seguroVida)}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">Seguro de danos</p>
                    <p className="text-lg font-semibold">{currencyFormatter.format(firstInstallment.seguroDanos)}</p>
                  </div>
                </div>
              )}

              {simulation?.calculation && (
                <div className="mt-4 rounded-lg bg-muted/40 p-4 text-sm">
                  <p>Cuota total referencial: <strong>{currencyFormatter.format(simulation.calculation.cuotaReferencial)}</strong></p>
                  <p>Comision total: <strong>{currencyFormatter.format(simulation.calculation.totalComision)}</strong></p>
                  <p>
                    Tasas aplicadas: Vida {simulation.rates.seguroVidaPct}% | Danos {simulation.rates.seguroDanosPct}%
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Tabla de Amortizacion (Sistema Frances)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cuota</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead className="text-right">Capital</TableHead>
                      <TableHead className="text-right">Interes</TableHead>
                      <TableHead className="text-right">Seguro Vida</TableHead>
                      <TableHead className="text-right">Seguro Danos</TableHead>
                      <TableHead className="text-right">Cuota Total</TableHead>
                      <TableHead className="text-right">Saldo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(simulation?.amortization ?? []).map((row) => (
                      <TableRow key={row.numeroCuota}>
                        <TableCell>{row.numeroCuota}</TableCell>
                        <TableCell>{new Date(row.fechaVencimiento).toLocaleDateString('es-NI')}</TableCell>
                        <TableCell className="text-right">{currencyFormatter.format(row.capital)}</TableCell>
                        <TableCell className="text-right">{currencyFormatter.format(row.interes)}</TableCell>
                        <TableCell className="text-right">{currencyFormatter.format(row.seguroVida)}</TableCell>
                        <TableCell className="text-right">{currencyFormatter.format(row.seguroDanos)}</TableCell>
                        <TableCell className="text-right font-semibold">{currencyFormatter.format(row.cuotaTotal)}</TableCell>
                        <TableCell className="text-right">{currencyFormatter.format(row.saldoCapital)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Simulator;

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { calculateLoan } from "@/lib/dashboardApi";
import { SIMULATION_DRAFT_STORAGE_KEY, type SimulationDraft } from "@/lib/simulationDraft";

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
    cuotaReferencial: number;
    totalComision: number;
  };
  rates: {
    seguroVidaPct: number;
    seguroDanosPct: number;
    comisionPct: number;
  };
  amortization: AmortizationRow[];
}

const currency = new Intl.NumberFormat("es-NI", {
  style: "currency",
  currency: "NIO",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const escapeCsvValue = (value: string) =>
  value.includes(",") || value.includes("\n") || value.includes('"')
    ? `"${value.replaceAll('"', '""')}"`
    : value;

const oneMonthFromNow = () => {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  return `${d.getFullYear()}-${`${d.getMonth() + 1}`.padStart(2, "0")}-${`${d.getDate()}`.padStart(2, "0")}`;
};

const Simulator = () => {
  const navigate = useNavigate();
  const [amount, setAmount] = useState(50000);
  const [termMonths, setTermMonths] = useState(24);
  const [frequency, setFrequency] = useState<"SEMANAL" | "QUINCENAL" | "MENSUAL">("MENSUAL");
  const [annualRate, setAnnualRate] = useState(2);
  const [commissionPct, setCommissionPct] = useState(0);
  const [loanType, setLoanType] = useState("PERSONAL");
  const [destino, setDestino] = useState("");
  const [firstDueDate, setFirstDueDate] = useState(oneMonthFromNow());
  const [simulation, setSimulation] = useState<SimulationResponse | null>(null);
  const [loadingSimulation, setLoadingSimulation] = useState(false);

  useEffect(() => {
    const t = setTimeout(async () => {
      try {
        setLoadingSimulation(true);
        setSimulation(
          await calculateLoan({
            monto_solicitado: amount,
            plazo_meses: termMonths,
            frecuencia: frequency,
            tasa_interes: annualRate,
            comisionPct: commissionPct,
            firstDueDate,
          }),
        );
      } catch {
        setSimulation(null);
      } finally {
        setLoadingSimulation(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [amount, termMonths, frequency, annualRate, commissionPct, firstDueDate]);

  const launchApplication = () => {
    if (!simulation) {
      toast({
        title: "Simulacion incompleta",
        description: "Calcula primero la cuota para iniciar el tramite.",
        variant: "destructive",
      });
      return;
    }

    const draft: SimulationDraft = {
      monto_solicitado: amount,
      plazo_meses: termMonths,
      frecuencia: frequency,
      tasa_interes: annualRate,
      tipo_credito: loanType,
      destino: destino.trim(),
      firstDueDate,
      rates: simulation.rates,
      calculation: simulation.calculation,
      amortization: simulation.amortization,
    };

    sessionStorage.setItem(SIMULATION_DRAFT_STORAGE_KEY, JSON.stringify(draft));
    navigate("/requests/new", { state: { simulationDraft: draft } });
  };

  const firstInstallment = simulation?.amortization?.[0];
  const amortizationRows = simulation?.amortization || [];

  const downloadAmortizationCsv = () => {
    if (amortizationRows.length === 0) return;

    const header = [
      "Cuota",
      "Fecha",
      "Capital",
      "Interes",
      "Seguro Vida",
      "Seguro Danos",
      "Cuota Total",
      "Saldo",
      "Estado",
    ];

    const rows = amortizationRows.map((row) =>
      [
        String(row.numeroCuota),
        new Date(row.fechaVencimiento).toLocaleDateString("es-NI"),
        currency.format(row.capital),
        currency.format(row.interes),
        currency.format(row.seguroVida),
        currency.format(row.seguroDanos),
        currency.format(row.cuotaTotal),
        currency.format(row.saldoCapital),
        "Pendiente",
      ]
        .map(escapeCsvValue)
        .join(","),
    );

    const csv = [header.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "tabla-amortizacion-proyectada.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const printAmortization = () => {
    if (amortizationRows.length === 0) return;

    const rowsHtml = amortizationRows
      .map(
        (row) => `
          <tr>
            <td>${row.numeroCuota}</td>
            <td>${escapeHtml(new Date(row.fechaVencimiento).toLocaleDateString("es-NI"))}</td>
            <td>${escapeHtml(currency.format(row.capital))}</td>
            <td>${escapeHtml(currency.format(row.interes))}</td>
            <td>${escapeHtml(currency.format(row.seguroVida))}</td>
            <td>${escapeHtml(currency.format(row.seguroDanos))}</td>
            <td>${escapeHtml(currency.format(row.cuotaTotal))}</td>
            <td>${escapeHtml(currency.format(row.saldoCapital))}</td>
            <td>Pendiente</td>
          </tr>`,
      )
      .join("");

    const html = `
      <!DOCTYPE html>
      <html lang="es">
        <head>
          <meta charset="UTF-8" />
          <title>Tabla de amortizacion proyectada</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 24px; color: #111827; }
            h1 { margin-bottom: 6px; font-size: 22px; }
            p { margin: 0 0 16px; color: #4b5563; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; }
            th, td { border: 1px solid #d1d5db; padding: 8px; text-align: left; }
            th { background: #f3f4f6; }
            .right { text-align: right; }
          </style>
        </head>
        <body>
          <h1>Tabla de amortizacion proyectada</h1>
          <p>Simulacion de credito Credia</p>
          <table>
            <thead>
              <tr>
                <th>Cuota</th>
                <th>Fecha</th>
                <th>Capital</th>
                <th>Interes</th>
                <th>Seg. Vida</th>
                <th>Seg. Danos</th>
                <th>Cuota Total</th>
                <th>Saldo</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
          </table>
        </body>
      </html>
    `;

    const printWindow = window.open("", "_blank", "width=1100,height=800");
    if (!printWindow) return;
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  return (
    <AppLayout
      title="Simulador de Credito"
      subtitle="Calculo independiente con sistema frances, seguros y tabla proyectada"
    >
      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="border-gray-200 shadow-xl xl:col-span-1">
          <CardHeader>
            <CardTitle>Parametros de simulacion</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-3">
              <div className="flex justify-between">
                <Label>Monto</Label>
                <span className="text-sm font-semibold text-gray-700">{currency.format(amount)}</span>
              </div>
              <Slider value={[amount]} onValueChange={([v]) => setAmount(v)} min={5000} max={300000} step={1000} />
            </div>

            <div className="space-y-3">
              <div className="flex justify-between">
                <Label>Plazo (meses)</Label>
                <span className="text-sm font-semibold text-gray-700">{termMonths}</span>
              </div>
              <Slider value={[termMonths]} onValueChange={([v]) => setTermMonths(v)} min={3} max={72} step={1} />
            </div>

            <div className="space-y-2">
              <Label>Frecuencia de pago</Label>
              <Select value={frequency} onValueChange={(v) => setFrequency(v as "SEMANAL" | "QUINCENAL" | "MENSUAL")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SEMANAL">Semanal</SelectItem>
                  <SelectItem value="QUINCENAL">Quincenal</SelectItem>
                  <SelectItem value="MENSUAL">Mensual</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Tasa mensual (%)</Label>
              <Input type="number" value={annualRate} onChange={(e) => setAnnualRate(Number(e.target.value) || 0)} />
            </div>

            <div className="space-y-2">
              <Label>Comision por Desembolso (%)</Label>
              <Input type="number" min="0" value={commissionPct} onChange={(e) => setCommissionPct(Math.max(0, Number(e.target.value) || 0))} />
            </div>

            <div className="space-y-2">
              <Label>Primer vencimiento</Label>
              <Input type="date" value={firstDueDate} onChange={(e) => setFirstDueDate(e.target.value)} />
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
              <Label>Destino</Label>
              <Input value={destino} onChange={(e) => setDestino(e.target.value)} />
            </div>

            <Button
              className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700"
              disabled={!simulation || loadingSimulation}
              onClick={launchApplication}
            >
              Iniciar Solicitud con estos datos
            </Button>
          </CardContent>
        </Card>

        <div className="space-y-6 xl:col-span-2">
          <Card className="border-gray-200 shadow-xl">
            <CardHeader>
              <CardTitle>Cuota real (Sistema Frances + Seguros)</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingSimulation ? (
                <p className="text-sm text-gray-500">Calculando...</p>
              ) : !firstInstallment ? (
                <p className="text-sm text-gray-500">Sin datos para mostrar.</p>
              ) : (
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  {[
                    ["Capital", firstInstallment.capital],
                    ["Interes", firstInstallment.interes],
                    ["Seguro Vida", firstInstallment.seguroVida],
                    ["Seguro Danos", firstInstallment.seguroDanos],
                  ].map(([k, v]) => (
                    <div key={k as string} className="rounded-xl border border-gray-200 bg-gradient-to-r from-cyan-50 to-blue-50 p-3">
                      <p className="text-xs text-gray-500">{k}</p>
                      <p className="text-lg font-bold text-gray-900">{currency.format(v as number)}</p>
                    </div>
                  ))}
                </div>
              )}

              {simulation?.calculation && (
                <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
                  <p>
                    Cuota total referencial: <strong>{currency.format(simulation.calculation.cuotaReferencial)}</strong>
                  </p>
                  <p>
                    Comision total: <strong>{currency.format(simulation.calculation.totalComision)}</strong>
                  </p>
                  <p>
                    Tasas aplicadas: Vida {simulation.rates.seguroVidaPct}% | Danos {simulation.rates.seguroDanosPct}% | Comision {simulation.rates.comisionPct}%
                  </p>
                  <p>
                    Frecuencia: <strong>{frequency}</strong> | Numero de cuotas: <strong>{simulation.amortization.length}</strong>
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-gray-200 shadow-xl">
            <CardHeader>
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <CardTitle>Plan de amortizacion proyectada</CardTitle>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="border-gray-300"
                    onClick={printAmortization}
                    disabled={amortizationRows.length === 0}
                  >
                    Imprimir
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="border-gray-300"
                    onClick={downloadAmortizationCsv}
                    disabled={amortizationRows.length === 0}
                  >
                    Descargar
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border border-gray-200">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cuota</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead className="text-right">Capital</TableHead>
                      <TableHead className="text-right">Interes</TableHead>
                      <TableHead className="text-right">Seg. Vida</TableHead>
                      <TableHead className="text-right">Seg. Danos</TableHead>
                      <TableHead className="text-right">Cuota Total</TableHead>
                      <TableHead className="text-right">Saldo</TableHead>
                      <TableHead>Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {amortizationRows.map((r) => (
                      <TableRow key={r.numeroCuota}>
                        <TableCell>{r.numeroCuota}</TableCell>
                        <TableCell>{new Date(r.fechaVencimiento).toLocaleDateString("es-NI")}</TableCell>
                        <TableCell className="text-right">{currency.format(r.capital)}</TableCell>
                        <TableCell className="text-right">{currency.format(r.interes)}</TableCell>
                        <TableCell className="text-right">{currency.format(r.seguroVida)}</TableCell>
                        <TableCell className="text-right">{currency.format(r.seguroDanos)}</TableCell>
                        <TableCell className="text-right font-semibold">{currency.format(r.cuotaTotal)}</TableCell>
                        <TableCell className="text-right">{currency.format(r.saldoCapital)}</TableCell>
                        <TableCell>
                          <span className="rounded-full bg-yellow-100 px-2 py-1 text-xs font-medium text-yellow-800">
                            Pendiente
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
};

export default Simulator;

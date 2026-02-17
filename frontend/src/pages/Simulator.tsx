import { useEffect, useMemo, useState, type FormEvent } from "react";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { calculateLoan, createClient, createLoan, getClients } from "@/lib/dashboardApi";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface ClientOption { id: number; full_name?: string; nombres?: string; apellidos?: string; identificacion?: string; email?: string; }
interface AmortizationRow { numeroCuota: number; fechaVencimiento: string; capital: number; interes: number; seguroVida: number; seguroDanos: number; cuotaTotal: number; saldoCapital: number; }
interface SimulationResponse { calculation: { cuotaReferencial: number; totalComision: number }; rates: { seguroVidaPct: number; seguroDanosPct: number; comisionPct: number }; amortization: AmortizationRow[]; }
type Step = 1 | 2 | 3;
type ClientForm = { identificacion: string; tipo_identificacion: string; nombres: string; apellidos: string; fecha_nacimiento: string; genero: string; telefono: string; email: string; direccion: string; ocupacion: string; ingreso_mensual: string; estado_civil: string; };
type Analysis = { salario: number; otrosIngresos: number; vivienda: number; alimentacion: number; transporte: number; deudas: number; otrosEgresos: number; };

const steps = [{ id: 1, label: "Cliente" }, { id: 2, label: "Calculo" }, { id: 3, label: "Analisis" }] as const;
const clientInit: ClientForm = { identificacion: "", tipo_identificacion: "DNI", nombres: "", apellidos: "", fecha_nacimiento: "", genero: "", telefono: "", email: "", direccion: "", ocupacion: "", ingreso_mensual: "", estado_civil: "" };
const analysisInit: Analysis = { salario: 0, otrosIngresos: 0, vivienda: 0, alimentacion: 0, transporte: 0, deudas: 0, otrosEgresos: 0 };
const currency = new Intl.NumberFormat("es-NI", { style: "currency", currency: "NIO", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const oneMonthFromNow = () => { const d = new Date(); d.setMonth(d.getMonth() + 1); return `${d.getFullYear()}-${`${d.getMonth() + 1}`.padStart(2, "0")}-${`${d.getDate()}`.padStart(2, "0")}`; };

const Simulator = () => {
  const [step, setStep] = useState<Step>(1);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [clientId, setClientId] = useState("");
  const [clientSearch, setClientSearch] = useState("");
  const [clientForm, setClientForm] = useState<ClientForm>(clientInit);
  const [creatingClient, setCreatingClient] = useState(false);
  const [amount, setAmount] = useState(50000);
  const [termMonths, setTermMonths] = useState(24);
  const [annualRate, setAnnualRate] = useState(24);
  const [loanType, setLoanType] = useState("PERSONAL");
  const [destino, setDestino] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [firstDueDate, setFirstDueDate] = useState(oneMonthFromNow());
  const [simulation, setSimulation] = useState<SimulationResponse | null>(null);
  const [loadingSimulation, setLoadingSimulation] = useState(false);
  const [analysis, setAnalysis] = useState<Analysis>(analysisInit);
  const [loadingSubmit, setLoadingSubmit] = useState(false);

  const loadClients = async () => {
    try { const res = await getClients(); setClients(res.clients || []); } catch { toast({ title: "Error", description: "No se pudo cargar clientes", variant: "destructive" }); }
  };
  useEffect(() => { loadClients(); }, []);
  useEffect(() => {
    const t = setTimeout(async () => {
      try { setLoadingSimulation(true); setSimulation(await calculateLoan({ monto_solicitado: amount, plazo_meses: termMonths, tasa_interes: annualRate, firstDueDate })); }
      catch { setSimulation(null); } finally { setLoadingSimulation(false); }
    }, 300);
    return () => clearTimeout(t);
  }, [amount, termMonths, annualRate, firstDueDate]);

  const clientLabel = (c: ClientOption) => `${c.full_name || `${c.nombres ?? ""} ${c.apellidos ?? ""}`.trim()}${c.identificacion ? ` - ${c.identificacion}` : ""}`;
  const filteredClients = useMemo(() => {
    const q = clientSearch.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter((c) => clientLabel(c).toLowerCase().includes(q) || c.email?.toLowerCase().includes(q));
  }, [clients, clientSearch]);
  const incomesTotal = analysis.salario + analysis.otrosIngresos;
  const expensesTotal = analysis.vivienda + analysis.alimentacion + analysis.transporte + analysis.deudas + analysis.otrosEgresos;
  const disponible = incomesTotal - expensesTotal;
  const canSubmit = Number(clientId) > 0 && amount > 0 && termMonths > 0 && annualRate >= 0 && !!simulation && Object.values(analysis).every((v) => v >= 0);

  const createClientSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      setCreatingClient(true);
      const res = await createClient({
        identificacion: clientForm.identificacion, tipo_identificacion: clientForm.tipo_identificacion || "DNI", nombres: clientForm.nombres, apellidos: clientForm.apellidos,
        fecha_nacimiento: clientForm.fecha_nacimiento || null, genero: clientForm.genero || null, telefono: clientForm.telefono || null, email: clientForm.email || null,
        direccion: clientForm.direccion || null, ocupacion: clientForm.ocupacion || null, ingreso_mensual: clientForm.ingreso_mensual ? Number(clientForm.ingreso_mensual) : null, estado_civil: clientForm.estado_civil || null,
      });
      await loadClients(); if (res?.client?.id) setClientId(String(res.client.id)); setClientForm(clientInit);
      toast({ title: "Cliente creado", description: "Cliente creado y seleccionado." });
    } catch (error) {
      toast({ title: "Error", description: error instanceof Error ? error.message : "No se pudo crear cliente", variant: "destructive" });
    } finally { setCreatingClient(false); }
  };

  const saveRequest = async () => {
    if (!canSubmit) return toast({ title: "Datos incompletos", description: "Completa todos los pasos", variant: "destructive" });
    try {
      setLoadingSubmit(true);
      await createLoan({
        cliente_id: Number(clientId), monto_solicitado: amount, plazo_meses: termMonths, tasa_interes: annualRate, tipo_credito: loanType,
        destino: destino || null, observaciones: observaciones || null, firstDueDate, seguroVidaPct: simulation?.rates?.seguroVidaPct, seguroDanosPct: simulation?.rates?.seguroDanosPct, comisionPct: simulation?.rates?.comisionPct,
        analisis: {
          ingresos: { salario: analysis.salario, otros: analysis.otrosIngresos },
          egresos: { vivienda: analysis.vivienda, alimentacion: analysis.alimentacion, transporte: analysis.transporte, deudas: analysis.deudas, otros: analysis.otrosEgresos },
          resumen: { ingresosTotales: incomesTotal, egresosTotales: expensesTotal, disponible },
        },
      });
      toast({ title: "Solicitud guardada", description: "Credito registrado como PENDIENTE." });
      setAnalysis(analysisInit); setObservaciones(""); setDestino(""); setStep(1);
    } catch (error) {
      toast({ title: "Error", description: error instanceof Error ? error.message : "No se pudo guardar", variant: "destructive" });
    } finally { setLoadingSubmit(false); }
  };

  const next = () => {
    if (step === 1 && Number(clientId) <= 0) return toast({ title: "Selecciona cliente", variant: "destructive" });
    if (step === 2 && !simulation) return toast({ title: "Genera calculo", variant: "destructive" });
    setStep((s) => Math.min(3, (s + 1) as Step));
  };
  const prev = () => setStep((s) => Math.max(1, (s - 1) as Step));
  const setA = (k: keyof Analysis, v: string) => setAnalysis((p) => ({ ...p, [k]: Math.max(0, Number(v) || 0) }));
  const firstInstallment = simulation?.amortization?.[0];

  return (
    <AppLayout title="Nuevo Credito" subtitle="Flujo por pasos: Cliente, Calculo y Analisis financiero">
      <div className="space-y-6">
        <Card className="border-gray-200 shadow-xl"><CardContent className="grid gap-3 p-4 md:grid-cols-3">{steps.map((s) => <div key={s.id} className={`rounded-xl border px-4 py-3 text-sm font-semibold ${s.id === step ? "border-cyan-300 bg-gradient-to-r from-cyan-50 to-blue-50 text-cyan-800 shadow-md" : s.id < step ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-gray-200 bg-white text-gray-500"}`}>Paso {s.id}: {s.label}</div>)}</CardContent></Card>
        {step === 1 && <div className="grid gap-6 xl:grid-cols-2">
          <Card className="border-gray-200 shadow-xl"><CardHeader><CardTitle>Seleccionar cliente</CardTitle></CardHeader><CardContent className="space-y-4">
            <div className="space-y-2"><Label>Buscar cliente</Label><Input value={clientSearch} onChange={(e) => setClientSearch(e.target.value)} placeholder="Nombre, identificacion o email" /></div>
            <div className="space-y-2"><Label>Cliente</Label><Select value={clientId} onValueChange={setClientId}><SelectTrigger><SelectValue placeholder="Selecciona un cliente" /></SelectTrigger><SelectContent>{filteredClients.map((c) => <SelectItem key={c.id} value={String(c.id)}>{clientLabel(c)}</SelectItem>)}</SelectContent></Select></div>
          </CardContent></Card>
          <Card className="border-gray-200 shadow-xl"><CardHeader><CardTitle>Crear cliente en cl.clientes</CardTitle></CardHeader><CardContent>
            <form onSubmit={createClientSubmit} className="grid gap-3 md:grid-cols-2">
              {[
                ["identificacion", "Identificacion", "text"], ["tipo_identificacion", "Tipo ID", "text"], ["nombres", "Nombres", "text"], ["apellidos", "Apellidos", "text"],
                ["fecha_nacimiento", "Fecha nacimiento", "date"], ["genero", "Genero", "text"], ["telefono", "Telefono", "text"], ["email", "Email", "email"],
                ["direccion", "Direccion", "text"], ["ocupacion", "Ocupacion", "text"], ["ingreso_mensual", "Ingreso mensual", "number"], ["estado_civil", "Estado civil", "text"],
              ].map(([k, l, t]) => <div className={k === "direccion" ? "space-y-1.5 md:col-span-2" : "space-y-1.5"} key={k}><Label htmlFor={k}>{l}</Label><Input id={k} type={t} min={t === "number" ? "0" : undefined} required={k === "identificacion" || k === "nombres" || k === "apellidos"} value={clientForm[k as keyof ClientForm]} onChange={(e) => setClientForm((p) => ({ ...p, [k]: e.target.value }))} /></div>)}
              <div className="md:col-span-2"><Button type="submit" disabled={creatingClient} className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700">{creatingClient ? "Creando..." : "Crear cliente"}</Button></div>
            </form>
          </CardContent></Card>
        </div>}
        {step === 2 && <div className="grid gap-6 xl:grid-cols-3">
          <Card className="border-gray-200 shadow-xl xl:col-span-1"><CardHeader><CardTitle>Parametros de calculo</CardTitle></CardHeader><CardContent className="space-y-5">
            <div className="space-y-3"><div className="flex justify-between"><Label>Monto</Label><span className="text-sm font-semibold text-gray-700">{currency.format(amount)}</span></div><Slider value={[amount]} onValueChange={([v]) => setAmount(v)} min={5000} max={300000} step={1000} /></div>
            <div className="space-y-3"><div className="flex justify-between"><Label>Plazo (meses)</Label><span className="text-sm font-semibold text-gray-700">{termMonths}</span></div><Slider value={[termMonths]} onValueChange={([v]) => setTermMonths(v)} min={3} max={72} step={1} /></div>
            <div className="space-y-2"><Label>Tasa anual (%)</Label><Input type="number" value={annualRate} onChange={(e) => setAnnualRate(Number(e.target.value) || 0)} /></div>
            <div className="space-y-2"><Label>Primer vencimiento</Label><Input type="date" value={firstDueDate} onChange={(e) => setFirstDueDate(e.target.value)} /></div>
            <div className="space-y-2"><Label>Tipo de credito</Label><Select value={loanType} onValueChange={setLoanType}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="PERSONAL">PERSONAL</SelectItem><SelectItem value="COMERCIAL">COMERCIAL</SelectItem><SelectItem value="HIPOTECARIO">HIPOTECARIO</SelectItem></SelectContent></Select></div>
            <div className="space-y-2"><Label>Destino</Label><Input value={destino} onChange={(e) => setDestino(e.target.value)} /></div>
          </CardContent></Card>
          <div className="space-y-6 xl:col-span-2">
            <Card className="border-gray-200 shadow-xl"><CardHeader><CardTitle>Cuota real (Sistema Frances + Seguros)</CardTitle></CardHeader><CardContent>
              {loadingSimulation ? <p className="text-sm text-gray-500">Calculando...</p> : !firstInstallment ? <p className="text-sm text-gray-500">Sin datos para mostrar.</p> : <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">{[
                ["Capital", firstInstallment.capital], ["Interes", firstInstallment.interes], ["Seguro Vida", firstInstallment.seguroVida], ["Seguro Danos", firstInstallment.seguroDanos],
              ].map(([k, v]) => <div key={k as string} className="rounded-xl border border-gray-200 bg-gradient-to-r from-cyan-50 to-blue-50 p-3"><p className="text-xs text-gray-500">{k}</p><p className="text-lg font-bold text-gray-900">{currency.format(v as number)}</p></div>)}</div>}
              {simulation?.calculation && <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700"><p>Cuota total referencial: <strong>{currency.format(simulation.calculation.cuotaReferencial)}</strong></p><p>Comision total: <strong>{currency.format(simulation.calculation.totalComision)}</strong></p><p>Tasas aplicadas: Vida {simulation.rates.seguroVidaPct}% | Danos {simulation.rates.seguroDanosPct}%</p></div>}
            </CardContent></Card>
            <Card className="border-gray-200 shadow-xl"><CardHeader><CardTitle>Plan de amortizacion referencial</CardTitle></CardHeader><CardContent><div className="rounded-md border border-gray-200"><Table><TableHeader><TableRow><TableHead>Cuota</TableHead><TableHead>Fecha</TableHead><TableHead className="text-right">Capital</TableHead><TableHead className="text-right">Interes</TableHead><TableHead className="text-right">Seg. Vida</TableHead><TableHead className="text-right">Seg. Danos</TableHead><TableHead className="text-right">Cuota Total</TableHead><TableHead className="text-right">Saldo</TableHead></TableRow></TableHeader><TableBody>{(simulation?.amortization || []).map((r) => <TableRow key={r.numeroCuota}><TableCell>{r.numeroCuota}</TableCell><TableCell>{new Date(r.fechaVencimiento).toLocaleDateString("es-NI")}</TableCell><TableCell className="text-right">{currency.format(r.capital)}</TableCell><TableCell className="text-right">{currency.format(r.interes)}</TableCell><TableCell className="text-right">{currency.format(r.seguroVida)}</TableCell><TableCell className="text-right">{currency.format(r.seguroDanos)}</TableCell><TableCell className="text-right font-semibold">{currency.format(r.cuotaTotal)}</TableCell><TableCell className="text-right">{currency.format(r.saldoCapital)}</TableCell></TableRow>)}</TableBody></Table></div></CardContent></Card>
          </div>
        </div>}
        {step === 3 && <div className="grid gap-6 xl:grid-cols-2">
          <Card className="border-gray-200 shadow-xl"><CardHeader><CardTitle>Analisis de ingresos y egresos</CardTitle></CardHeader><CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">{[
              ["salario", "Ingreso salario"], ["otrosIngresos", "Otros ingresos"], ["vivienda", "Egreso vivienda"], ["alimentacion", "Egreso alimentacion"], ["transporte", "Egreso transporte"], ["deudas", "Egreso deudas"], ["otrosEgresos", "Otros egresos"],
            ].map(([k, l]) => <div key={k} className={k === "otrosEgresos" ? "space-y-1.5 md:col-span-2" : "space-y-1.5"}><Label htmlFor={k}>{l}</Label><Input id={k} type="number" min="0" value={analysis[k as keyof Analysis]} onChange={(e) => setA(k as keyof Analysis, e.target.value)} /></div>)}</div>
            <div className="space-y-1.5"><Label>Observaciones</Label><Textarea rows={4} value={observaciones} onChange={(e) => setObservaciones(e.target.value)} placeholder="Notas del analista" /></div>
          </CardContent></Card>
          <Card className="border-gray-200 shadow-xl"><CardHeader><CardTitle>Resumen financiero</CardTitle></CardHeader><CardContent className="space-y-4 text-sm">
            {[
              ["Ingresos totales", incomesTotal, "text-gray-900"], ["Egresos totales", expensesTotal, "text-gray-900"], ["Disponible", disponible, disponible < 0 ? "text-red-600" : "text-emerald-600"],
            ].map(([k, v, c]) => <div className="rounded-xl border border-gray-200 bg-gradient-to-r from-cyan-50 to-blue-50 p-4" key={k as string}><p className="text-gray-600">{k}</p><p className={`text-xl font-bold ${c}`}>{currency.format(v as number)}</p></div>)}
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4"><p>Cuota referencial calculada: <strong>{currency.format(simulation?.calculation?.cuotaReferencial ?? 0)}</strong></p><p className="mt-1 text-gray-600">Al confirmar, el credito se registra como PENDIENTE.</p></div>
          </CardContent></Card>
        </div>}
        <div className="flex items-center justify-between">
          <Button variant="outline" className="border-gray-300" onClick={prev} disabled={step === 1 || loadingSubmit}>Anterior</Button>
          {step < 3 ? <Button className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700" onClick={next}>Siguiente</Button> : <Button className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700" onClick={saveRequest} disabled={!canSubmit || loadingSubmit}>{loadingSubmit ? "Guardando..." : "Guardar solicitud"}</Button>}
        </div>
      </div>
    </AppLayout>
  );
};

export default Simulator;

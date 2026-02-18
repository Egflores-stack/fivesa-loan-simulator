import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import AppLayout from "@/components/AppLayout";
import { toast } from "@/hooks/use-toast";
import {
  ApiRequestError,
  approveLoan,
  checkClientExists,
  createLoan,
  getClientById,
  getClients,
  getLoans,
  rejectLoan,
} from "@/lib/dashboardApi";
import { SIMULATION_DRAFT_STORAGE_KEY, type SimulationDraft } from "@/lib/simulationDraft";

type Step = 1 | 2 | 3 | 4;
type FieldErrors = Record<string, string>;
type ClientOptionSource = {
  id: number;
  full_name?: string;
  nombres?: string;
  apellidos?: string;
  identificacion?: string;
};
type LoanRow = {
  id: number; codigo: string; cliente_nombre: string; cliente_email?: string; tipo_credito: string;
  monto_solicitado: number; tasa_interes: number; plazo_meses: number; estado: string;
  fecha_solicitud: string; asesor_nombre?: string; cuota_referencial?: number;
};
type FormState = {
  cliente: { identificacion: string; tipo_identificacion: string; nombre: string; telefono_1: string; telefono_2: string; email: string; direccion: string };
  perfil: { actividadEconomica: string; lugarTrabajo: string; antiguedadLaboral: string };
  analisis: { salarioBruto: number; deduccionInss: number; deduccionIr: number; egresoAlquiler: number; egresoServicios: number; egresoAlimentacion: number };
  garantias: Array<{ descripcion: string; valorEstimado: number }>;
  referencias: Array<{ nombre: string; telefono: string; parentesco: string }>;
  observaciones: string;
};

const initialForm: FormState = {
  cliente: { identificacion: "", tipo_identificacion: "DNI", nombre: "", telefono_1: "", telefono_2: "", email: "", direccion: "" },
  perfil: { actividadEconomica: "", lugarTrabajo: "", antiguedadLaboral: "" },
  analisis: { salarioBruto: 0, deduccionInss: 0, deduccionIr: 0, egresoAlquiler: 0, egresoServicios: 0, egresoAlimentacion: 0 },
  garantias: [{ descripcion: "", valorEstimado: 0 }],
  referencias: [{ nombre: "", telefono: "", parentesco: "" }, { nombre: "", telefono: "", parentesco: "" }],
  observaciones: "",
};
const steps: Array<{ id: Step; label: string }> = [
  { id: 1, label: "Datos Cliente" }, { id: 2, label: "Perfil" }, { id: 3, label: "Analisis" }, { id: 4, label: "Garantias/Referencias" },
];
const statusOptions = [{ value: "TODOS", label: "Todos" }, { value: "PENDIENTE", label: "Pendientes" }, { value: "APROBADO", label: "Aprobados" }, { value: "RECHAZADO", label: "Rechazados" }];
const currency = new Intl.NumberFormat("es-NI", { style: "currency", currency: "NIO", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const safeNum = (v: number) => (Number.isFinite(v) ? v : 0);
const err = (m: FieldErrors, k: string) => (m[k] ? <p className="text-xs font-medium text-red-600">{m[k]}</p> : null);
const nextStep = (s: Step): Step => (s === 1 ? 2 : s === 2 ? 3 : 4);
const prevStep = (s: Step): Step => (s === 4 ? 3 : s === 3 ? 2 : 1);

const Requests = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const isFormMode = location.pathname === "/requests/new";
  const [rows, setRows] = useState<LoanRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("PENDIENTE");
  const [selectedLoan, setSelectedLoan] = useState<LoanRow | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  const [showRejectionDialog, setShowRejectionDialog] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [simulationDraft, setSimulationDraft] = useState<SimulationDraft | null>(null);
  const [clientOptions, setClientOptions] = useState<Array<{ id: number; label: string }>>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [form, setForm] = useState<FormState>(initialForm);
  const [step, setStep] = useState<Step>(1);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(false);
  const [existingClientId, setExistingClientId] = useState<number | null>(null);
  const [existingClientNotice, setExistingClientNotice] = useState("");

  useEffect(() => {
    if (!isFormMode) return;
    const fromRoute = (location.state as { simulationDraft?: SimulationDraft } | null)?.simulationDraft;
    if (fromRoute) return setSimulationDraft(fromRoute);
    const raw = sessionStorage.getItem(SIMULATION_DRAFT_STORAGE_KEY);
    if (!raw) return setSimulationDraft(null);
    try { setSimulationDraft(JSON.parse(raw)); } catch { setSimulationDraft(null); }
  }, [isFormMode, location.state]);

  useEffect(() => {
    if (!isFormMode) return;
    const loadClientOptions = async () => {
      try {
        const response = await getClients();
        const list = (response.clients || []).map((c: ClientOptionSource) => ({
          id: c.id,
          label: `${c.full_name || `${c.nombres || ""} ${c.apellidos || ""}`.trim()} - ${c.identificacion || ""}`,
        }));
        setClientOptions(list);
      } catch {
        setClientOptions([]);
      }
    };
    loadClientOptions();
  }, [isFormMode]);

  const loadLoans = useCallback(async () => {
    try { setLoading(true); const status = statusFilter === "TODOS" ? undefined : statusFilter; const r = await getLoans(status); setRows(r.loans || []); }
    catch { toast({ title: "Error", description: "No se pudieron cargar las solicitudes", variant: "destructive" }); }
    finally { setLoading(false); }
  }, [statusFilter]);
  useEffect(() => { if (!isFormMode) loadLoans(); }, [isFormMode, loadLoans]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase(); if (!q) return rows;
    return rows.filter((l) => l.codigo?.toLowerCase().includes(q) || l.cliente_nombre?.toLowerCase().includes(q) || l.cliente_email?.toLowerCase().includes(q) || l.tipo_credito?.toLowerCase().includes(q));
  }, [rows, search]);

  const ingresoNeto = Math.max(0, safeNum(form.analisis.salarioBruto) - safeNum(form.analisis.deduccionInss) - safeNum(form.analisis.deduccionIr));
  const egresosFamiliares = safeNum(form.analisis.egresoAlquiler) + safeNum(form.analisis.egresoServicios) + safeNum(form.analisis.egresoAlimentacion);
  const disponibilidadFinal = ingresoNeto - egresosFamiliares;

  const checkExisting = async () => {
    const identificacion = form.cliente.identificacion.trim(); const email = form.cliente.email.trim();
    if (!identificacion && !email) return null;
    try {
      setChecking(true); const result = await checkClientExists({ identificacion, email });
      const found = result.existsByIdentificacion || result.existsByEmail;
      setExistingClientId(found ? (result.clientId ?? null) : null);
      setExistingClientNotice(found ? "Cliente existente encontrado. Se vinculara automaticamente." : "");
      return result;
    } catch { return null; } finally { setChecking(false); }
  };

  const applyClientFromProfile = async (clientId: string) => {
    setSelectedClientId(clientId);
    if (!clientId) return;
    try {
      const response = await getClientById(Number(clientId));
      const client = response.client || {};
      setForm((prev) => ({
        ...prev,
        cliente: {
          ...prev.cliente,
          identificacion: client.identificacion || "",
          tipo_identificacion: client.tipo_identificacion || "DNI",
          nombre: client.nombre || client.full_name || `${client.nombres || ""} ${client.apellidos || ""}`.trim(),
          telefono_1: client.telefono_1 || client.telefono || "",
          telefono_2: client.telefono_2 || "",
          email: client.email || "",
          direccion: client.direccion || "",
        },
        perfil: {
          ...prev.perfil,
          actividadEconomica: client.actividad_economica || client.ocupacion || "",
          lugarTrabajo: client.lugar_trabajo || "",
          antiguedadLaboral: client.antiguedad_laboral || "",
        },
        analisis: {
          ...prev.analisis,
          salarioBruto: Number(client.salario_bruto ?? client.ingreso_mensual ?? 0),
          deduccionInss: Number(client.inss ?? 0),
          deduccionIr: Number(client.ir ?? 0),
          egresoAlquiler: Number(client.egreso_alquiler ?? 0),
          egresoServicios: Number(client.egreso_servicios ?? 0),
          egresoAlimentacion: Number(client.egreso_alimentacion ?? 0),
        },
        garantias: prev.garantias.length > 0
          ? prev.garantias.map((item, idx) =>
              idx === 0
                ? { ...item, descripcion: client.garantia_descripcion || item.descripcion || "" }
                : item,
            )
          : [{ descripcion: client.garantia_descripcion || "", valorEstimado: 0 }],
        referencias: [
          {
            ...prev.referencias[0],
            nombre: client.referencia_1_nombre || prev.referencias[0]?.nombre || "",
            telefono: client.referencia_1_telefono || prev.referencias[0]?.telefono || "",
          },
          {
            ...prev.referencias[1],
            nombre: client.referencia_2_nombre || prev.referencias[1]?.nombre || "",
            telefono: client.referencia_2_telefono || prev.referencias[1]?.telefono || "",
          },
        ],
      }));
      setExistingClientId(Number(clientId));
      setExistingClientNotice("Cliente existente cargado en el formulario.");
    } catch {
      toast({ title: "Error", description: "No se pudo cargar el perfil del cliente seleccionado", variant: "destructive" });
    }
  };

  const validateStep = (s: Step) => {
    const e: FieldErrors = {};
    if (s === 1) {
      if (!form.cliente.identificacion.trim()) e["cliente.identificacion"] = "La cedula es obligatoria";
      if (!form.cliente.nombre.trim()) e["cliente.nombre"] = "El nombre es obligatorio";
      if (form.cliente.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.cliente.email.trim())) e["cliente.email"] = "Correo invalido";
    }
    if (s === 2) {
      if (!form.perfil.actividadEconomica.trim()) e["perfil.actividadEconomica"] = "Requerido";
      if (!form.perfil.lugarTrabajo.trim()) e["perfil.lugarTrabajo"] = "Requerido";
      if (!form.perfil.antiguedadLaboral.trim()) e["perfil.antiguedadLaboral"] = "Requerido";
      if (!form.referencias[0]?.nombre?.trim() || !form.referencias[0]?.telefono?.trim()) e["referencias.r1"] = "Referencia 1 incompleta";
      if (!form.referencias[1]?.nombre?.trim() || !form.referencias[1]?.telefono?.trim()) e["referencias.r2"] = "Referencia 2 incompleta";
    }
    if (s === 3 && form.analisis.salarioBruto <= 0) e["analisis.salarioBruto"] = "Debe ser mayor que 0";
    setFieldErrors(e); return Object.keys(e).length === 0;
  };

  const submitFivesa = async () => {
    if (!simulationDraft) return toast({ title: "Sin simulacion", description: "Debes iniciar desde Simulador", variant: "destructive" });
    if (!validateStep(4)) return toast({ title: "Datos incompletos", description: "Revisa el formulario", variant: "destructive" });
    const existing = await checkExisting();
    const totalDeducciones = safeNum(form.analisis.deduccionInss) + safeNum(form.analisis.deduccionIr);
    try {
      setSaving(true); setFormError("");
      await createLoan({
        ...((existing?.clientId ?? existingClientId) ? { cliente_id: existing?.clientId ?? existingClientId } : {}),
        monto_solicitado: simulationDraft.monto_solicitado, plazo_meses: simulationDraft.plazo_meses, frecuencia: simulationDraft.frecuencia, tasa_interes: simulationDraft.tasa_interes, tipo_credito: simulationDraft.tipo_credito,
        destino: simulationDraft.destino || null, firstDueDate: simulationDraft.firstDueDate, seguroVidaPct: simulationDraft.rates.seguroVidaPct, seguroDanosPct: simulationDraft.rates.seguroDanosPct, comisionPct: simulationDraft.rates.comisionPct,
        cliente: { ...form.cliente, nombres: form.cliente.nombre.trim() || "N/D", apellidos: ".", actividad_economica: form.perfil.actividadEconomica, lugar_trabajo: form.perfil.lugarTrabajo, antiguedad_laboral: form.perfil.antiguedadLaboral, salario_bruto: form.analisis.salarioBruto, inss: form.analisis.deduccionInss, ir: form.analisis.deduccionIr, egreso_alquiler: form.analisis.egresoAlquiler, egreso_servicios: form.analisis.egresoServicios, egreso_alimentacion: form.analisis.egresoAlimentacion, garantia_descripcion: form.garantias[0]?.descripcion || "", referencia_1_nombre: form.referencias[0]?.nombre || "", referencia_1_telefono: form.referencias[0]?.telefono || "", referencia_2_nombre: form.referencias[1]?.nombre || "", referencia_2_telefono: form.referencias[1]?.telefono || "", ocupacion: form.perfil.actividadEconomica, ingreso_mensual: ingresoNeto, telefono: form.cliente.telefono_1 },
        perfil: form.perfil,
        analisis: { capacidadPago: { salarioBruto: form.analisis.salarioBruto, inss: form.analisis.deduccionInss, ir: form.analisis.deduccionIr, ingresoNeto, egresosFamiliares: { alquiler: form.analisis.egresoAlquiler, servicios: form.analisis.egresoServicios, alimentacion: form.analisis.egresoAlimentacion, total: egresosFamiliares }, disponibilidadFinal, deduccionesTotales: totalDeducciones } },
        garantias: form.garantias, referencias: form.referencias, observaciones: form.observaciones,
      });
      sessionStorage.removeItem(SIMULATION_DRAFT_STORAGE_KEY);
      setForm(initialForm); setStep(1); setFieldErrors({}); setFormError(""); setExistingClientId(null); setExistingClientNotice(""); setSelectedClientId("");
      toast({ title: "Solicitud registrada", description: "Guardada en bandeja de pendientes." });
      navigate("/requests");
    } catch (error) {
      let message = "No se pudo guardar la solicitud"; const nextErrors: FieldErrors = {};
      if (error instanceof ApiRequestError) {
        message = error.message || message;
        if (error.fieldErrors && typeof error.fieldErrors === "object") Object.assign(nextErrors, error.fieldErrors);
        if (error.code === "DUPLICATE_IDENTIFICACION") { message = "Error: La cedula ya existe"; nextErrors["cliente.identificacion"] = "La cedula ya existe"; setStep(1); }
        if (error.code === "DUPLICATE_EMAIL") { message = "Error: El correo ya existe"; nextErrors["cliente.email"] = "El correo ya existe"; setStep(1); }
        if (error.code === "CLIENT_NOT_FOUND") { message = "Error: No se encontro el cliente"; setFormError("No se pudo vincular el cliente. Verifica cedula/correo."); setStep(1); }
      }
      setFieldErrors((p) => ({ ...p, ...nextErrors })); setFormError(message);
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  const setClient = (k: keyof FormState["cliente"], v: string) => { setForm((p) => ({ ...p, cliente: { ...p.cliente, [k]: v } })); setFieldErrors((p) => { const n = { ...p }; delete n[`cliente.${k}`]; return n; }); };
  const setPerfil = (k: keyof FormState["perfil"], v: string) => { setForm((p) => ({ ...p, perfil: { ...p.perfil, [k]: v } })); };
  const setAnalisis = (k: keyof FormState["analisis"], v: string) => { setForm((p) => ({ ...p, analisis: { ...p.analisis, [k]: Math.max(0, Number(v) || 0) } })); };

  if (isFormMode) {
    return (
      <AppLayout title="Nueva Solicitud - FIVESA" subtitle="Stepper de captura de solicitud">
        <div className="space-y-6">
          <Card className="border-gray-200 shadow-xl"><CardContent className="grid gap-3 p-4 md:grid-cols-4">{steps.map((s) => <div key={s.id} className={`rounded-xl border px-4 py-3 text-sm font-semibold ${s.id === step ? "border-cyan-300 bg-gradient-to-r from-cyan-50 to-blue-50 text-cyan-800 shadow-md" : s.id < step ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-gray-200 bg-white text-gray-500"}`}>Paso {s.id}: {s.label}</div>)}</CardContent></Card>
          <Card className="border-gray-200 shadow-xl"><CardHeader><CardTitle>Resumen de simulacion</CardTitle><CardDescription>Datos transferidos desde Simulador</CardDescription></CardHeader><CardContent>{!simulationDraft ? <Button className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700" onClick={() => navigate("/simulator")}>Ir al Simulador</Button> : <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6"><div className="rounded-xl border border-gray-200 bg-gradient-to-r from-cyan-50 to-blue-50 p-3"><p className="text-xs text-gray-500">Monto</p><p className="text-lg font-bold text-gray-900">{currency.format(simulationDraft.monto_solicitado)}</p></div><div className="rounded-xl border border-gray-200 bg-gradient-to-r from-cyan-50 to-blue-50 p-3"><p className="text-xs text-gray-500">Plazo</p><p className="text-lg font-bold text-gray-900">{simulationDraft.plazo_meses} meses</p></div><div className="rounded-xl border border-gray-200 bg-gradient-to-r from-cyan-50 to-blue-50 p-3"><p className="text-xs text-gray-500">Frecuencia</p><p className="text-lg font-bold text-gray-900">{simulationDraft.frecuencia}</p></div><div className="rounded-xl border border-gray-200 bg-gradient-to-r from-cyan-50 to-blue-50 p-3"><p className="text-xs text-gray-500">Tasa</p><p className="text-lg font-bold text-gray-900">{simulationDraft.tasa_interes.toFixed(2)}%</p></div><div className="rounded-xl border border-gray-200 bg-gradient-to-r from-cyan-50 to-blue-50 p-3"><p className="text-xs text-gray-500">Tipo</p><p className="text-lg font-bold text-gray-900">{simulationDraft.tipo_credito}</p></div><div className="rounded-xl border border-gray-200 bg-gradient-to-r from-cyan-50 to-blue-50 p-3"><p className="text-xs text-gray-500">Cuota Mensual</p><p className="text-lg font-bold text-gray-900">{currency.format(simulationDraft.calculation.cuotaReferencial)}</p></div></div>}</CardContent></Card>
          {formError && <Alert variant="destructive" className="border-red-200"><AlertDescription>{formError}</AlertDescription></Alert>}
          {existingClientNotice && <Alert className="border-cyan-200 bg-cyan-50 text-cyan-800"><AlertDescription>{existingClientNotice}</AlertDescription></Alert>}

          {step === 1 && <Card className="border-gray-200 shadow-xl"><CardHeader><CardTitle>Datos del Cliente</CardTitle></CardHeader><CardContent className="grid gap-3 md:grid-cols-2"><div className="space-y-1.5 md:col-span-2"><Label>Seleccionar cliente existente</Label><Select value={selectedClientId} onValueChange={applyClientFromProfile}><SelectTrigger><SelectValue placeholder="Selecciona un cliente para autocompletar (opcional)" /></SelectTrigger><SelectContent>{clientOptions.map((opt) => <SelectItem key={opt.id} value={String(opt.id)}>{opt.label}</SelectItem>)}</SelectContent></Select></div><div className="space-y-1.5"><Label>Identificacion</Label><Input value={form.cliente.identificacion} onBlur={checkExisting} onChange={(e) => setClient("identificacion", e.target.value)} />{err(fieldErrors, "cliente.identificacion")}</div><div className="space-y-1.5"><Label>Tipo ID</Label><Input value={form.cliente.tipo_identificacion} onChange={(e) => setClient("tipo_identificacion", e.target.value)} /></div><div className="space-y-1.5"><Label>Nombre</Label><Input value={form.cliente.nombre} onChange={(e) => setClient("nombre", e.target.value)} />{err(fieldErrors, "cliente.nombre")}</div><div className="space-y-1.5"><Label>Telefono 1</Label><Input value={form.cliente.telefono_1} onChange={(e) => setClient("telefono_1", e.target.value)} /></div><div className="space-y-1.5"><Label>Telefono 2</Label><Input value={form.cliente.telefono_2} onChange={(e) => setClient("telefono_2", e.target.value)} /></div><div className="space-y-1.5"><Label>Email</Label><Input type="email" value={form.cliente.email} onBlur={checkExisting} onChange={(e) => setClient("email", e.target.value)} />{err(fieldErrors, "cliente.email")}</div><div className="space-y-1.5 md:col-span-2"><Label>Direccion</Label><Input value={form.cliente.direccion} onChange={(e) => setClient("direccion", e.target.value)} /></div>{checking && <p className="md:col-span-2 text-xs text-gray-500">Validando cliente existente...</p>}</CardContent></Card>}
          {step === 2 && <Card className="border-gray-200 shadow-xl"><CardHeader><CardTitle>Perfil</CardTitle></CardHeader><CardContent className="grid gap-3 md:grid-cols-2"><div className="space-y-1.5"><Label>Actividad economica</Label><Input value={form.perfil.actividadEconomica} onChange={(e) => setPerfil("actividadEconomica", e.target.value)} />{err(fieldErrors, "perfil.actividadEconomica")}</div><div className="space-y-1.5"><Label>Lugar de trabajo</Label><Input value={form.perfil.lugarTrabajo} onChange={(e) => setPerfil("lugarTrabajo", e.target.value)} />{err(fieldErrors, "perfil.lugarTrabajo")}</div><div className="space-y-1.5"><Label>Antiguedad</Label><Input value={form.perfil.antiguedadLaboral} onChange={(e) => setPerfil("antiguedadLaboral", e.target.value)} />{err(fieldErrors, "perfil.antiguedadLaboral")}</div><div className="space-y-1.5"><Label>Referencia 1 - Nombre</Label><Input value={form.referencias[0].nombre} onChange={(e) => setForm((p) => ({ ...p, referencias: p.referencias.map((x, i) => i === 0 ? { ...x, nombre: e.target.value } : x) }))} />{err(fieldErrors, "referencias.r1")}</div><div className="space-y-1.5"><Label>Referencia 1 - Telefono</Label><Input value={form.referencias[0].telefono} onChange={(e) => setForm((p) => ({ ...p, referencias: p.referencias.map((x, i) => i === 0 ? { ...x, telefono: e.target.value } : x) }))} /></div><div className="space-y-1.5"><Label>Referencia 2 - Nombre</Label><Input value={form.referencias[1].nombre} onChange={(e) => setForm((p) => ({ ...p, referencias: p.referencias.map((x, i) => i === 1 ? { ...x, nombre: e.target.value } : x) }))} />{err(fieldErrors, "referencias.r2")}</div><div className="space-y-1.5"><Label>Referencia 2 - Telefono</Label><Input value={form.referencias[1].telefono} onChange={(e) => setForm((p) => ({ ...p, referencias: p.referencias.map((x, i) => i === 1 ? { ...x, telefono: e.target.value } : x) }))} /></div></CardContent></Card>}
          {step === 3 && <Card className="border-gray-200 shadow-xl"><CardHeader><CardTitle>Capacidad de Pago</CardTitle><CardDescription>Calculo en vivo de ingreso neto y disponibilidad final</CardDescription></CardHeader><CardContent className="grid gap-3 md:grid-cols-3"><div className="space-y-1.5"><Label>Salario Bruto</Label><Input type="number" min="0" value={form.analisis.salarioBruto} onChange={(e) => setAnalisis("salarioBruto", e.target.value)} />{err(fieldErrors, "analisis.salarioBruto")}</div><div className="space-y-1.5"><Label>INSS</Label><Input type="number" min="0" value={form.analisis.deduccionInss} onChange={(e) => setAnalisis("deduccionInss", e.target.value)} /></div><div className="space-y-1.5"><Label>IR</Label><Input type="number" min="0" value={form.analisis.deduccionIr} onChange={(e) => setAnalisis("deduccionIr", e.target.value)} /></div><div className="space-y-1.5"><Label>Egreso Familiar - Alquiler</Label><Input type="number" min="0" value={form.analisis.egresoAlquiler} onChange={(e) => setAnalisis("egresoAlquiler", e.target.value)} /></div><div className="space-y-1.5"><Label>Egreso Familiar - Servicios</Label><Input type="number" min="0" value={form.analisis.egresoServicios} onChange={(e) => setAnalisis("egresoServicios", e.target.value)} /></div><div className="space-y-1.5"><Label>Egreso Familiar - Alimentacion</Label><Input type="number" min="0" value={form.analisis.egresoAlimentacion} onChange={(e) => setAnalisis("egresoAlimentacion", e.target.value)} /></div><div className="space-y-1.5"><Label>Ingreso Neto</Label><Input readOnly value={ingresoNeto.toFixed(2)} className="bg-gray-50" /></div><div className="space-y-1.5"><Label>Disponibilidad Final</Label><Input readOnly value={disponibilidadFinal.toFixed(2)} className={`${disponibilidadFinal < 0 ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`} /></div></CardContent></Card>}
          {step === 4 && <Card className="border-gray-200 shadow-xl"><CardHeader><CardTitle>Garantias</CardTitle></CardHeader><CardContent className="space-y-6"><div className="space-y-2"><div className="flex items-center justify-between"><Label>Garantias</Label><Button type="button" variant="outline" className="border-gray-300" onClick={() => setForm((p) => ({ ...p, garantias: [...p.garantias, { descripcion: "", valorEstimado: 0 }] }))}>Agregar garantia</Button></div><div className="rounded-md border border-gray-200"><Table><TableHeader><TableRow><TableHead>Descripcion</TableHead><TableHead>Valor (NIO)</TableHead></TableRow></TableHeader><TableBody>{form.garantias.map((g, i) => <TableRow key={`g-${i}`}><TableCell><Input value={g.descripcion} onChange={(e) => setForm((p) => ({ ...p, garantias: p.garantias.map((x, ix) => ix === i ? { ...x, descripcion: e.target.value } : x) }))} /></TableCell><TableCell><Input type="number" min="0" value={g.valorEstimado} onChange={(e) => setForm((p) => ({ ...p, garantias: p.garantias.map((x, ix) => ix === i ? { ...x, valorEstimado: Math.max(0, Number(e.target.value) || 0) } : x) }))} /></TableCell></TableRow>)}</TableBody></Table></div></div><div className="space-y-1.5"><Label>Observaciones</Label><Textarea rows={4} value={form.observaciones} onChange={(e) => setForm((p) => ({ ...p, observaciones: e.target.value }))} /></div></CardContent></Card>}

          <div className="flex items-center justify-between">
            <Button variant="outline" className="border-gray-300" onClick={step === 1 ? () => navigate("/simulator") : () => setStep((s) => prevStep(s))}>{step === 1 ? "Volver al Simulador" : "Anterior"}</Button>
            {step < 4 ? <Button className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700" onClick={async () => { if (!validateStep(step)) return toast({ title: "Datos incompletos", description: "Completa los campos obligatorios", variant: "destructive" }); if (step === 1) await checkExisting(); setStep((s) => nextStep(s)); }}>Siguiente</Button> : <Button className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700" onClick={submitFivesa} disabled={!simulationDraft || saving}>{saving ? "Guardando..." : "Guardar Solicitud"}</Button>}
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Bandeja de Solicitudes" subtitle="Gestion, aprobacion y rechazo de creditos">
      <div className="space-y-6">
        <Card className="border-gray-200 shadow-xl"><CardContent className="p-4"><div className="flex flex-col gap-3 md:flex-row"><Input placeholder="Buscar por codigo, cliente, email o tipo" value={search} onChange={(e) => setSearch(e.target.value)} /><Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="w-full md:w-56"><SelectValue /></SelectTrigger><SelectContent>{statusOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent></Select><Button variant="outline" className="border-gray-300" onClick={loadLoans} disabled={loading}>{loading ? "Actualizando..." : "Actualizar"}</Button></div></CardContent></Card>
        <Card className="border-gray-200 shadow-xl"><CardHeader><CardTitle>Solicitudes ({filteredRows.length})</CardTitle></CardHeader><CardContent><div className="rounded-md border"><Table><TableHeader><TableRow><TableHead>Codigo</TableHead><TableHead>Cliente</TableHead><TableHead>Tipo</TableHead><TableHead className="text-right">Monto</TableHead><TableHead className="text-right">Tasa</TableHead><TableHead className="text-right">Plazo</TableHead><TableHead className="text-right">Cuota Mensual</TableHead><TableHead>Estado</TableHead><TableHead>Fecha</TableHead><TableHead className="text-right">Acciones</TableHead></TableRow></TableHeader><TableBody>{filteredRows.map((l) => <TableRow key={l.id}><TableCell className="font-medium">{l.codigo}</TableCell><TableCell><div className="text-sm"><p className="font-medium">{l.cliente_nombre}</p><p className="text-muted-foreground">{l.cliente_email || "-"}</p></div></TableCell><TableCell>{l.tipo_credito}</TableCell><TableCell className="text-right">{currency.format(l.monto_solicitado)}</TableCell><TableCell className="text-right">{l.tasa_interes.toFixed(2)}%</TableCell><TableCell className="text-right">{l.plazo_meses}</TableCell><TableCell className="text-right">{currency.format(l.cuota_referencial ?? 0)}</TableCell><TableCell><span className={`rounded-full px-2 py-1 text-xs font-medium ${l.estado === "APROBADO" ? "bg-green-100 text-green-800" : l.estado === "RECHAZADO" ? "bg-red-100 text-red-800" : "bg-yellow-100 text-yellow-800"}`}>{l.estado}</span></TableCell><TableCell>{new Date(l.fecha_solicitud).toLocaleDateString("es-NI")}</TableCell><TableCell className="text-right"><div className="flex justify-end gap-2"><Button size="sm" variant="outline" onClick={() => { setSelectedLoan(l); setShowDetailsDialog(true); }}>Ver</Button>{l.estado === "PENDIENTE" && <><Button size="sm" className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700" onClick={() => { setSelectedLoan(l); setShowApprovalDialog(true); }}>Aprobar</Button><Button size="sm" variant="destructive" onClick={() => { setSelectedLoan(l); setShowRejectionDialog(true); }}>Rechazar</Button></>}</div></TableCell></TableRow>)}{!loading && filteredRows.length === 0 && <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground">No hay resultados para los filtros actuales.</TableCell></TableRow>}</TableBody></Table></div></CardContent></Card>
      </div>

      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}><DialogContent><DialogHeader><DialogTitle>Detalle de solicitud</DialogTitle></DialogHeader>{selectedLoan && <div className="grid gap-3 text-sm"><div><Label>Codigo</Label><p>{selectedLoan.codigo}</p></div><div><Label>Cliente</Label><p>{selectedLoan.cliente_nombre}</p></div><div><Label>Email</Label><p>{selectedLoan.cliente_email || "-"}</p></div><div><Label>Monto</Label><p>{currency.format(selectedLoan.monto_solicitado)}</p></div><div><Label>Cuota mensual</Label><p>{currency.format(selectedLoan.cuota_referencial ?? 0)}</p></div><div><Label>Estado</Label><p>{selectedLoan.estado}</p></div></div>}</DialogContent></Dialog>
      <Dialog open={showApprovalDialog} onOpenChange={setShowApprovalDialog}><DialogContent><DialogHeader><DialogTitle>Aprobar solicitud</DialogTitle></DialogHeader><div className="space-y-4"><p className="text-sm text-muted-foreground">Se aprobara la solicitud {selectedLoan?.codigo}.</p><div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setShowApprovalDialog(false)}>Cancelar</Button><Button className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700" onClick={async () => { if (!selectedLoan) return; try { await approveLoan(selectedLoan.id, {}); setShowApprovalDialog(false); await loadLoans(); } catch { toast({ title: "Error", description: "No se pudo aprobar", variant: "destructive" }); } }}>Confirmar aprobacion</Button></div></div></DialogContent></Dialog>
      <Dialog open={showRejectionDialog} onOpenChange={setShowRejectionDialog}><DialogContent><DialogHeader><DialogTitle>Rechazar solicitud</DialogTitle></DialogHeader><div className="space-y-4"><div><Label htmlFor="reason">Motivo</Label><Textarea id="reason" value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} rows={4} /></div><div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setShowRejectionDialog(false)}>Cancelar</Button><Button variant="destructive" disabled={!rejectionReason.trim()} onClick={async () => { if (!selectedLoan) return; try { await rejectLoan(selectedLoan.id, { rejectionReason }); setShowRejectionDialog(false); setRejectionReason(""); await loadLoans(); } catch { toast({ title: "Error", description: "No se pudo rechazar", variant: "destructive" }); } }}>Confirmar rechazo</Button></div></div></DialogContent></Dialog>
    </AppLayout>
  );
};

export default Requests;





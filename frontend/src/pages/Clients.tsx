import { useEffect, useMemo, useState, type FormEvent } from "react";
import AppLayout from "@/components/AppLayout";
import { ApiRequestError, createClient, getClientById, getClients } from "@/lib/dashboardApi";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

type Client = {
  id: number;
  identificacion: string;
  nombres: string;
  apellidos: string;
  email?: string;
  telefono?: string;
  telefono_1?: string;
  telefono_2?: string;
  ingreso_mensual?: number;
  full_name?: string;
  direccion?: string;
  ocupacion?: string;
  actividad_economica?: string;
  lugar_trabajo?: string;
  antiguedad_laboral?: string;
  salario_bruto?: number;
  inss?: number;
  ir?: number;
  egreso_alquiler?: number;
  egreso_servicios?: number;
  egreso_alimentacion?: number;
  garantia_descripcion?: string;
  referencia_1_nombre?: string;
  referencia_1_telefono?: string;
  referencia_2_nombre?: string;
  referencia_2_telefono?: string;
};

type ClientLoan = {
  id: number;
  codigo?: string;
  monto_solicitado?: number;
  tipo_credito?: string;
  estado?: string;
  fecha_solicitud?: string;
};

const initialForm = {
  identificacion: "",
  nombre: "",
  email: "",
  telefono_1: "",
  telefono_2: "",
  actividad_economica: "",
  lugar_trabajo: "",
  antiguedad_laboral: "",
  salario_bruto: "",
  inss: "",
  ir: "",
  egreso_alquiler: "",
  egreso_servicios: "",
  egreso_alimentacion: "",
  garantia_descripcion: "",
  referencia_1_nombre: "",
  referencia_1_telefono: "",
  referencia_2_nombre: "",
  referencia_2_telefono: "",
  ingreso_mensual: "",
  direccion: "",
};

const Clients = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [selectedClientLoans, setSelectedClientLoans] = useState<ClientLoan[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(initialForm);
  const [formError, setFormError] = useState("");

  const loadClients = async () => {
    try {
      setLoading(true);
      const response = await getClients();
      setClients(response.clients || []);
    } catch {
      toast({
        title: "Error",
        description: "No se pudo cargar la lista de perfiles",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadClientProfile = async (clientId: number) => {
    try {
      const response = await getClientById(clientId);
      setSelectedClient(response.client || null);
      setSelectedClientLoans(response.loans || []);
    } catch {
      toast({
        title: "Error",
        description: "No se pudo cargar la ficha del cliente",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    loadClients();
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError("");
    try {
      setSaving(true);
      const created = await createClient({
        identificacion: form.identificacion,
        nombres: form.nombre.trim() || "N/D",
        apellidos: ".",
        email: form.email || null,
        telefono: form.telefono_1 || null,
        direccion: form.direccion || null,
        ocupacion: form.actividad_economica || null,
        ingreso_mensual: form.salario_bruto ? Number(form.salario_bruto) : null,
        fivesa_profile: {
          telefono_1: form.telefono_1 || null,
          telefono_2: form.telefono_2 || null,
          actividad_economica: form.actividad_economica || null,
          lugar_trabajo: form.lugar_trabajo || null,
          antiguedad_laboral: form.antiguedad_laboral || null,
          salario_bruto: form.salario_bruto ? Number(form.salario_bruto) : null,
          inss: form.inss ? Number(form.inss) : null,
          ir: form.ir ? Number(form.ir) : null,
          egreso_alquiler: form.egreso_alquiler ? Number(form.egreso_alquiler) : null,
          egreso_servicios: form.egreso_servicios ? Number(form.egreso_servicios) : null,
          egreso_alimentacion: form.egreso_alimentacion ? Number(form.egreso_alimentacion) : null,
          garantia_descripcion: form.garantia_descripcion || null,
          referencia_1_nombre: form.referencia_1_nombre || null,
          referencia_1_telefono: form.referencia_1_telefono || null,
          referencia_2_nombre: form.referencia_2_nombre || null,
          referencia_2_telefono: form.referencia_2_telefono || null,
          direccion: form.direccion || null,
        },
      });
      toast({ title: "Perfil creado", description: "El perfil del cliente fue registrado correctamente." });
      if (created?.client?.id) {
        await loadClients();
        await loadClientProfile(created.client.id);
      } else {
        await loadClients();
      }
      setForm(initialForm);
    } catch (error) {
      if (error instanceof ApiRequestError) {
        setFormError(error.message);
      }
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "No se pudo guardar el perfil.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const filteredClients = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter((client) => {
      const fullName = `${client.nombres} ${client.apellidos}`.toLowerCase();
      return (
        fullName.includes(q) ||
        client.identificacion?.toLowerCase().includes(q) ||
        client.email?.toLowerCase().includes(q)
      );
    });
  }, [clients, search]);

  return (
    <AppLayout
      title="Perfil de Cliente"
      subtitle="Ingreso, consulta y ficha completa de clientes"
    >
      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="border-gray-200 shadow-xl xl:col-span-1">
          <CardHeader>
            <CardTitle className="text-gray-900">Ingresar perfil</CardTitle>
          </CardHeader>
          <CardContent>
            {formError && (
              <Alert variant="destructive" className="mb-4 border-red-200">
                <AlertDescription>{formError}</AlertDescription>
              </Alert>
            )}
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-2"><Label>Identificacion</Label><Input required value={form.identificacion} onChange={(e) => setForm((p) => ({ ...p, identificacion: e.target.value }))} /></div>
              <div className="space-y-2"><Label>Nombre</Label><Input required value={form.nombre} onChange={(e) => setForm((p) => ({ ...p, nombre: e.target.value }))} /></div>
              <div className="space-y-2"><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} /></div>
              <div className="space-y-2"><Label>Telefono 1</Label><Input value={form.telefono_1} onChange={(e) => setForm((p) => ({ ...p, telefono_1: e.target.value }))} /></div>
              <div className="space-y-2"><Label>Telefono 2</Label><Input value={form.telefono_2} onChange={(e) => setForm((p) => ({ ...p, telefono_2: e.target.value }))} /></div>
              <div className="space-y-2"><Label>Actividad Economica</Label><Input value={form.actividad_economica} onChange={(e) => setForm((p) => ({ ...p, actividad_economica: e.target.value }))} /></div>
              <div className="space-y-2"><Label>Lugar de Trabajo</Label><Input value={form.lugar_trabajo} onChange={(e) => setForm((p) => ({ ...p, lugar_trabajo: e.target.value }))} /></div>
              <div className="space-y-2"><Label>Antiguedad Laboral</Label><Input value={form.antiguedad_laboral} onChange={(e) => setForm((p) => ({ ...p, antiguedad_laboral: e.target.value }))} /></div>
              <div className="space-y-2"><Label>Salario Bruto</Label><Input type="number" min="0" value={form.salario_bruto} onChange={(e) => setForm((p) => ({ ...p, salario_bruto: e.target.value }))} /></div>
              <div className="space-y-2"><Label>INSS</Label><Input type="number" min="0" value={form.inss} onChange={(e) => setForm((p) => ({ ...p, inss: e.target.value }))} /></div>
              <div className="space-y-2"><Label>IR</Label><Input type="number" min="0" value={form.ir} onChange={(e) => setForm((p) => ({ ...p, ir: e.target.value }))} /></div>
              <div className="space-y-2"><Label>Egreso Alquiler</Label><Input type="number" min="0" value={form.egreso_alquiler} onChange={(e) => setForm((p) => ({ ...p, egreso_alquiler: e.target.value }))} /></div>
              <div className="space-y-2"><Label>Egreso Servicios</Label><Input type="number" min="0" value={form.egreso_servicios} onChange={(e) => setForm((p) => ({ ...p, egreso_servicios: e.target.value }))} /></div>
              <div className="space-y-2"><Label>Egreso Alimentacion</Label><Input type="number" min="0" value={form.egreso_alimentacion} onChange={(e) => setForm((p) => ({ ...p, egreso_alimentacion: e.target.value }))} /></div>
              <div className="space-y-2"><Label>Garantia (Descripcion)</Label><Input value={form.garantia_descripcion} onChange={(e) => setForm((p) => ({ ...p, garantia_descripcion: e.target.value }))} /></div>
              <div className="space-y-2"><Label>Referencia 1 Nombre</Label><Input value={form.referencia_1_nombre} onChange={(e) => setForm((p) => ({ ...p, referencia_1_nombre: e.target.value }))} /></div>
              <div className="space-y-2"><Label>Referencia 1 Telefono</Label><Input value={form.referencia_1_telefono} onChange={(e) => setForm((p) => ({ ...p, referencia_1_telefono: e.target.value }))} /></div>
              <div className="space-y-2"><Label>Referencia 2 Nombre</Label><Input value={form.referencia_2_nombre} onChange={(e) => setForm((p) => ({ ...p, referencia_2_nombre: e.target.value }))} /></div>
              <div className="space-y-2"><Label>Referencia 2 Telefono</Label><Input value={form.referencia_2_telefono} onChange={(e) => setForm((p) => ({ ...p, referencia_2_telefono: e.target.value }))} /></div>
              <div className="space-y-2"><Label>Direccion</Label><Input value={form.direccion} onChange={(e) => setForm((p) => ({ ...p, direccion: e.target.value }))} /></div>
              <Button type="submit" className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700" disabled={saving}>
                {saving ? "Guardando..." : "Guardar perfil"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-6 xl:col-span-2">
          <Card className="border-gray-200 shadow-xl">
            <CardHeader><CardTitle className="text-gray-900">Consultar perfiles</CardTitle></CardHeader>
            <CardContent>
              <div className="mb-4"><Input placeholder="Buscar por nombre, identificacion o email" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
              <div className="overflow-x-auto rounded-md border border-gray-200">
                <table className="w-full min-w-[750px]">
                  <thead>
                    <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wider text-gray-500">
                      <th className="px-2 py-3">Cliente</th>
                      <th className="px-2 py-3">Identificacion</th>
                      <th className="px-2 py-3">Email</th>
                      <th className="px-2 py-3">Telefono</th>
                      <th className="px-2 py-3 text-right">Ingreso</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredClients.map((client) => (
                      <tr key={client.id} className="cursor-pointer border-b border-gray-50 text-sm hover:bg-cyan-50/40" onClick={() => loadClientProfile(client.id)}>
                        <td className="px-2 py-3 font-medium text-gray-900">{client.nombres} {client.apellidos}</td>
                        <td className="px-2 py-3 text-gray-700">{client.identificacion}</td>
                        <td className="px-2 py-3 text-gray-700">{client.email || "-"}</td>
                        <td className="px-2 py-3 text-gray-700">{client.telefono || "-"}</td>
                        <td className="px-2 py-3 text-right text-gray-700">{Number(client.ingreso_mensual || 0).toLocaleString("es-NI", { style: "currency", currency: "NIO" })}</td>
                      </tr>
                    ))}
                    {!loading && filteredClients.length === 0 && (
                      <tr><td colSpan={5} className="px-2 py-6 text-center text-sm text-gray-500">Sin perfiles para mostrar.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Card className="border-gray-200 shadow-xl">
            <CardHeader><CardTitle className="text-gray-900">Ficha de cliente</CardTitle></CardHeader>
            <CardContent>
              {!selectedClient ? (
                <p className="text-sm text-gray-500">Selecciona un cliente para ver su ficha completa e historial.</p>
              ) : (
                <div className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-xl border border-gray-200 bg-gradient-to-r from-cyan-50 to-blue-50 p-3"><p className="text-xs text-gray-500">Nombre</p><p className="text-sm font-semibold text-gray-900">{selectedClient.full_name || `${selectedClient.nombres} ${selectedClient.apellidos}`}</p></div>
                    <div className="rounded-xl border border-gray-200 bg-gradient-to-r from-cyan-50 to-blue-50 p-3"><p className="text-xs text-gray-500">Identificacion</p><p className="text-sm font-semibold text-gray-900">{selectedClient.identificacion}</p></div>
                    <div className="rounded-xl border border-gray-200 bg-gradient-to-r from-cyan-50 to-blue-50 p-3"><p className="text-xs text-gray-500">Email</p><p className="text-sm font-semibold text-gray-900">{selectedClient.email || "-"}</p></div>
                    <div className="rounded-xl border border-gray-200 bg-gradient-to-r from-cyan-50 to-blue-50 p-3"><p className="text-xs text-gray-500">Telefono</p><p className="text-sm font-semibold text-gray-900">{selectedClient.telefono || "-"}</p></div>
                    <div className="rounded-xl border border-gray-200 bg-gradient-to-r from-cyan-50 to-blue-50 p-3"><p className="text-xs text-gray-500">Actividad Economica</p><p className="text-sm font-semibold text-gray-900">{selectedClient.ocupacion || "-"}</p></div>
                  </div>
                  <div className="rounded-md border border-gray-200">
                    <table className="w-full min-w-[620px]">
                      <thead>
                        <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wider text-gray-500">
                          <th className="px-2 py-2">Codigo</th>
                          <th className="px-2 py-2">Tipo</th>
                          <th className="px-2 py-2 text-right">Monto</th>
                          <th className="px-2 py-2">Estado</th>
                          <th className="px-2 py-2">Fecha</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedClientLoans.map((loan) => (
                          <tr key={loan.id} className="border-b border-gray-50 text-sm">
                            <td className="px-2 py-2 text-gray-700">{loan.codigo || `#${loan.id}`}</td>
                            <td className="px-2 py-2 text-gray-700">{loan.tipo_credito || "-"}</td>
                            <td className="px-2 py-2 text-right text-gray-700">{Number(loan.monto_solicitado || 0).toLocaleString("es-NI", { style: "currency", currency: "NIO" })}</td>
                            <td className="px-2 py-2"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${loan.estado === "APROBADO" ? "bg-emerald-100 text-emerald-700" : loan.estado === "RECHAZADO" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>{loan.estado || "-"}</span></td>
                            <td className="px-2 py-2 text-gray-700">{loan.fecha_solicitud ? new Date(loan.fecha_solicitud).toLocaleDateString("es-NI") : "-"}</td>
                          </tr>
                        ))}
                        {selectedClientLoans.length === 0 && (
                          <tr><td colSpan={5} className="px-2 py-4 text-center text-sm text-gray-500">Sin historial crediticio.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
};

export default Clients;

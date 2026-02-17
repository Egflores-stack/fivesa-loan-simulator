import { useEffect, useMemo, useState, type FormEvent } from "react";
import AppLayout from "@/components/AppLayout";
import { createClient, getClients } from "@/lib/dashboardApi";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Client = {
  id: number;
  identificacion: string;
  nombres: string;
  apellidos: string;
  email?: string;
  telefono?: string;
  ingreso_mensual?: number;
};

const initialForm = {
  identificacion: "",
  nombres: "",
  apellidos: "",
  email: "",
  telefono: "",
  ingreso_mensual: "",
};

const Clients = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(initialForm);

  const loadClients = async () => {
    try {
      setLoading(true);
      const response = await getClients();
      setClients(response.clients || []);
    } catch {
      toast({
        title: "Error",
        description: "No se pudo cargar la lista de clientes",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadClients();
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      setSaving(true);
      await createClient({
        identificacion: form.identificacion,
        nombres: form.nombres,
        apellidos: form.apellidos,
        email: form.email || null,
        telefono: form.telefono || null,
        ingreso_mensual: form.ingreso_mensual ? Number(form.ingreso_mensual) : null,
      });
      toast({ title: "Cliente guardado", description: "El cliente fue creado correctamente." });
      setForm(initialForm);
      await loadClients();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "No se pudo guardar el cliente.",
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
      title="Clientes"
      subtitle="Registro y consulta de clientes para solicitudes de credito"
    >
      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="border-gray-200 shadow-xl xl:col-span-1">
          <CardHeader>
            <CardTitle className="text-gray-900">Nuevo cliente</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="identificacion">Identificacion</Label>
                <Input
                  id="identificacion"
                  required
                  value={form.identificacion}
                  onChange={(event) => setForm((prev) => ({ ...prev, identificacion: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nombres">Nombres</Label>
                <Input
                  id="nombres"
                  required
                  value={form.nombres}
                  onChange={(event) => setForm((prev) => ({ ...prev, nombres: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="apellidos">Apellidos</Label>
                <Input
                  id="apellidos"
                  required
                  value={form.apellidos}
                  onChange={(event) => setForm((prev) => ({ ...prev, apellidos: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="telefono">Telefono</Label>
                <Input
                  id="telefono"
                  value={form.telefono}
                  onChange={(event) => setForm((prev) => ({ ...prev, telefono: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ingreso">Ingreso mensual</Label>
                <Input
                  id="ingreso"
                  type="number"
                  min="0"
                  value={form.ingreso_mensual}
                  onChange={(event) => setForm((prev) => ({ ...prev, ingreso_mensual: event.target.value }))}
                />
              </div>
              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700"
                disabled={saving}
              >
                {saving ? "Guardando..." : "Guardar cliente"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="border-gray-200 shadow-xl xl:col-span-2">
          <CardHeader>
            <CardTitle className="text-gray-900">Listado de clientes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <Input
                placeholder="Buscar por nombre, identificacion o email"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>

            <div className="overflow-x-auto">
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
                    <tr key={client.id} className="border-b border-gray-50 text-sm">
                      <td className="px-2 py-3 font-medium text-gray-900">
                        {client.nombres} {client.apellidos}
                      </td>
                      <td className="px-2 py-3 text-gray-700">{client.identificacion}</td>
                      <td className="px-2 py-3 text-gray-700">{client.email || "-"}</td>
                      <td className="px-2 py-3 text-gray-700">{client.telefono || "-"}</td>
                      <td className="px-2 py-3 text-right text-gray-700">
                        {Number(client.ingreso_mensual || 0).toLocaleString("es-NI", {
                          style: "currency",
                          currency: "NIO",
                        })}
                      </td>
                    </tr>
                  ))}
                  {!loading && filteredClients.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-2 py-6 text-center text-sm text-gray-500">
                        Sin clientes para mostrar.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default Clients;

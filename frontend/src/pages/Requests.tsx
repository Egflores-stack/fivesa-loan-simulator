import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import {
  createLoanRequest,
  deleteLoanRequest,
  fetchLoanRequests,
  updateLoanRequest,
  type LoanRequest,
} from "@/lib/requestApi";
import {
  formatCurrency,
  formatPercent,
  type CommissionType,
  type PaymentFrequency,
} from "@/lib/loanCalculations";
import { ClipboardList, Eye, Pencil, Trash2 } from "lucide-react";

const RESPONSABLES = ["Ana Morales", "Carlos López", "Equipo Fivesa"];
const GESTORES = ["María Reyes", "José Pérez", "Gestión Central"];

const buildDefaultRequest = (): Omit<
  LoanRequest,
  "id" | "status" | "requestDate"
> => ({
  type: "Nueva",
  currency: "NIO",
  amount: 0,
  termMonths: 12,
  monthlyRate: 3.5,
  paymentFrequency: "monthly",
  commissionType: "percentage",
  commissionValue: 2,
  previousBalance: null,
  responsible: RESPONSABLES[0],
  manager: GESTORES[0],
  paymentDates: "",
});

const Requests = () => {
  const { token } = useAuth();
  const [requests, setRequests] = useState<LoanRequest[]>([]);
  const [formData, setFormData] = useState(buildDefaultRequest());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshRequests = async () => {
    if (!token) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchLoanRequests(token);
      setRequests(data);
    } catch (fetchError) {
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : "No se pudieron cargar las solicitudes."
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void refreshRequests();
  }, [token]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token) return;
    setError(null);

    try {
      if (editingId) {
        const updated = await updateLoanRequest(token, editingId, formData);
        setRequests((prev) =>
          prev.map((item) => (item.id === updated.id ? updated : item))
        );
      } else {
        const created = await createLoanRequest(token, formData);
        setRequests((prev) => [created, ...prev]);
      }
      setFormData(buildDefaultRequest());
      setEditingId(null);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "No se pudo guardar la solicitud."
      );
    }
  };

  const handleEdit = (request: LoanRequest) => {
    setEditingId(request.id);
    setFormData({
      type: request.type,
      currency: request.currency,
      amount: request.amount,
      termMonths: request.termMonths,
      monthlyRate: request.monthlyRate,
      paymentFrequency: request.paymentFrequency,
      commissionType: request.commissionType,
      commissionValue: request.commissionValue,
      previousBalance: request.previousBalance ?? null,
      responsible: request.responsible,
      manager: request.manager,
      paymentDates: request.paymentDates ?? "",
    });
  };

  const handleDelete = async (id: string) => {
    if (!token) return;
    try {
      await deleteLoanRequest(token, id);
      setRequests((prev) => prev.filter((item) => item.id !== id));
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "No se pudo eliminar la solicitud."
      );
    }
  };

  const paymentCount = useMemo(() => {
    if (formData.paymentFrequency === "monthly") return formData.termMonths;
    if (formData.paymentFrequency === "biweekly") return formData.termMonths * 2;
    return formData.termMonths * 4;
  }, [formData.paymentFrequency, formData.termMonths]);

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-widest text-muted-foreground">
              Solicitudes
            </p>
            <h1 className="text-3xl font-semibold text-foreground">
              Gestión de Solicitudes
            </h1>
          </div>
          <Button asChild variant="outline">
            <Link to="/dashboard">Volver al dashboard</Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-8 px-4 py-10 lg:grid-cols-[1.1fr_0.9fr]">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <ClipboardList className="h-5 w-5 text-primary" />
              Nueva Solicitud
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-5" onSubmit={handleSubmit}>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(value) =>
                      setFormData((prev) => ({
                        ...prev,
                        type: value as "Nueva" | "Refinanciamiento",
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Nueva">Nueva</SelectItem>
                      <SelectItem value="Refinanciamiento">Refinanciamiento</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Moneda</Label>
                  <Select
                    value={formData.currency}
                    onValueChange={(value) =>
                      setFormData((prev) => ({
                        ...prev,
                        currency: value as "NIO" | "USD",
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NIO">NIO</SelectItem>
                      <SelectItem value="USD">USD</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Monto</Label>
                  <Input
                    type="number"
                    value={formData.amount}
                    onChange={(event) =>
                      setFormData((prev) => ({
                        ...prev,
                        amount: Number(event.target.value),
                      }))
                    }
                    min={0}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Plazo (meses)</Label>
                  <Input
                    type="number"
                    value={formData.termMonths}
                    onChange={(event) =>
                      setFormData((prev) => ({
                        ...prev,
                        termMonths: Number(event.target.value),
                      }))
                    }
                    min={1}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Interés mensual</Label>
                  <Input type="number" value={formData.monthlyRate} disabled />
                </div>
                <div className="space-y-2">
                  <Label>Frecuencia de pago</Label>
                  <Select
                    value={formData.paymentFrequency}
                    onValueChange={(value) =>
                      setFormData((prev) => ({
                        ...prev,
                        paymentFrequency: value as PaymentFrequency,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Mensual</SelectItem>
                      <SelectItem value="biweekly">Quincenal</SelectItem>
                      <SelectItem value="weekly">Semanal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Tipo comisión</Label>
                  <Select
                    value={formData.commissionType}
                    onValueChange={(value) =>
                      setFormData((prev) => ({
                        ...prev,
                        commissionType: value as CommissionType,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">Porcentaje</SelectItem>
                      <SelectItem value="amount">Monto</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Comisión</Label>
                  <Input
                    type="number"
                    value={formData.commissionValue}
                    onChange={(event) =>
                      setFormData((prev) => ({
                        ...prev,
                        commissionValue: Number(event.target.value),
                      }))
                    }
                    min={0}
                  />
                </div>
                {formData.type === "Refinanciamiento" ? (
                  <div className="space-y-2">
                    <Label>Saldo crédito anterior</Label>
                    <Input
                      type="number"
                      value={formData.previousBalance ?? ""}
                      onChange={(event) =>
                        setFormData((prev) => ({
                          ...prev,
                          previousBalance: Number(event.target.value),
                        }))
                      }
                      min={0}
                    />
                  </div>
                ) : null}
                <div className="space-y-2">
                  <Label>Responsable</Label>
                  <Select
                    value={formData.responsible}
                    onValueChange={(value) =>
                      setFormData((prev) => ({ ...prev, responsible: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona" />
                    </SelectTrigger>
                    <SelectContent>
                      {RESPONSABLES.map((item) => (
                        <SelectItem key={item} value={item}>
                          {item}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Gestor</Label>
                  <Select
                    value={formData.manager}
                    onValueChange={(value) =>
                      setFormData((prev) => ({ ...prev, manager: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona" />
                    </SelectTrigger>
                    <SelectContent>
                      {GESTORES.map((item) => (
                        <SelectItem key={item} value={item}>
                          {item}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Fechas de pago (texto)</Label>
                  <Input
                    value={formData.paymentDates ?? ""}
                    onChange={(event) =>
                      setFormData((prev) => ({
                        ...prev,
                        paymentDates: event.target.value,
                      }))
                    }
                  />
                </div>
              </div>
              <div className="rounded-lg border border-border bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
                <p>
                  No. Cuotas estimadas: <span className="font-semibold text-foreground">{paymentCount}</span>
                </p>
                <p>Interés mensual: {formatPercent(formData.monthlyRate)}</p>
              </div>
              {error ? (
                <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </p>
              ) : null}
              <div className="flex flex-wrap gap-3">
                <Button type="submit">
                  {editingId ? "Actualizar solicitud" : "Enviar solicitud"}
                </Button>
                {editingId ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setEditingId(null);
                      setFormData(buildDefaultRequest());
                    }}
                  >
                    Cancelar edición
                  </Button>
                ) : null}
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Solicitudes no procesadas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Cargando solicitudes...</p>
            ) : requests.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No hay solicitudes pendientes por ahora.
              </p>
            ) : (
              <div className="rounded-xl border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Moneda</TableHead>
                      <TableHead className="text-right">Monto</TableHead>
                      <TableHead className="text-right">Plazo</TableHead>
                      <TableHead>Responsable</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {requests.map((request) => (
                      <TableRow key={request.id}>
                        <TableCell>{request.type}</TableCell>
                        <TableCell>{request.currency}</TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(request.amount, request.currency)}
                        </TableCell>
                        <TableCell className="text-right">
                          {request.termMonths} meses
                        </TableCell>
                        <TableCell>{request.responsible}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button size="icon" variant="ghost">
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-lg">
                                <DialogHeader>
                                  <DialogTitle>Detalle de Solicitud</DialogTitle>
                                </DialogHeader>
                                <div className="space-y-3 text-sm">
                                  <p>
                                    <span className="font-medium">Monto:</span>{" "}
                                    {formatCurrency(request.amount, request.currency)}
                                  </p>
                                  <p>
                                    <span className="font-medium">Plazo:</span> {request.termMonths} meses
                                  </p>
                                  <p>
                                    <span className="font-medium">Frecuencia:</span> {request.paymentFrequency}
                                  </p>
                                  <p>
                                    <span className="font-medium">Comisión:</span>{" "}
                                    {request.commissionType === "percentage"
                                      ? `${request.commissionValue}%`
                                      : formatCurrency(request.commissionValue, request.currency)}
                                  </p>
                                  <p>
                                    <span className="font-medium">Responsable:</span> {request.responsible}
                                  </p>
                                  <p>
                                    <span className="font-medium">Gestor:</span> {request.manager}
                                  </p>
                                  <p>
                                    <span className="font-medium">Fecha trámite:</span> {request.requestDate}
                                  </p>
                                </div>
                              </DialogContent>
                            </Dialog>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleEdit(request)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleDelete(request.id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Requests;

import { useCallback, useEffect, useMemo, useState } from "react";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { getLoanDetails, getLoans, registerInstallmentPayment } from "@/lib/dashboardApi";
import { Mail, Send, Share2 } from "lucide-react";

type LoanOption = {
  id: number;
  codigo: string;
  cliente_nombre: string;
  monto_solicitado: number;
  estado: string;
};

type LoanDetailRow = {
  numero_cuota: number;
  fecha_vencimiento: string;
  capital: number;
  interes: number;
  cuota_total: number;
  saldo_capital: number;
  estado: string;
  fecha_pago?: string | null;
  monto_pagado?: number | null;
};

type LoanDetailPayload = {
  loan?: {
    id: number;
    codigo?: string;
    cliente_nombre?: string;
    monto_solicitado?: number;
    estado?: string;
  };
  amortization?: LoanDetailRow[];
};

const currency = new Intl.NumberFormat("es-NI", {
  style: "currency",
  currency: "NIO",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const normalizeInstallmentStatus = (status: string) => {
  const normalized = String(status || "").trim().toUpperCase();
  if (["PAGADO", "PAID", "CANCELADA", "CANCELADO"].includes(normalized)) {
    return "Cancelada";
  }
  return "Pendiente";
};

const statusClassName = (status: string) =>
  normalizeInstallmentStatus(status) === "Cancelada"
    ? "bg-emerald-100 text-emerald-700"
    : "bg-amber-100 text-amber-700";

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

const Reports = () => {
  const { user } = useAuth();
  const canRegisterPayments = user?.role === "Administrador" || user?.role === "Supervisor";
  const [loanOptions, setLoanOptions] = useState<LoanOption[]>([]);
  const [selectedLoanId, setSelectedLoanId] = useState("");
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [loadingStatement, setLoadingStatement] = useState(false);
  const [statement, setStatement] = useState<LoanDetailPayload | null>(null);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [selectedInstallment, setSelectedInstallment] = useState<LoanDetailRow | null>(null);
  const [paymentForm, setPaymentForm] = useState({
    paymentDate: new Date().toISOString().split("T")[0],
    paidAmount: "",
  });
  const [savingPayment, setSavingPayment] = useState(false);

  useEffect(() => {
    const loadApprovedLoans = async () => {
      try {
        setLoadingOptions(true);
        const response = await getLoans("APROBADO");
        setLoanOptions(response.loans || []);
      } catch {
        toast({
          title: "No se pudo cargar la reporteria",
          description: "No fue posible obtener los creditos aprobados.",
          variant: "destructive",
        });
      } finally {
        setLoadingOptions(false);
      }
    };

    loadApprovedLoans();
  }, []);

  const loadStatement = useCallback(async () => {
    if (!selectedLoanId) return;

    try {
      setLoadingStatement(true);
      const detail = await getLoanDetails(Number(selectedLoanId));
      setStatement(detail);
    } catch {
      setStatement(null);
      toast({
        title: "No se pudo generar el estado de cuenta",
        description: "No fue posible cargar el detalle del credito.",
        variant: "destructive",
      });
    } finally {
      setLoadingStatement(false);
    }
  }, [selectedLoanId]);

  useEffect(() => {
    if (!selectedLoanId) {
      setStatement(null);
      return;
    }

    loadStatement();
  }, [loadStatement, selectedLoanId]);

  const openPaymentDialog = (installment: LoanDetailRow) => {
    setSelectedInstallment(installment);
    setPaymentForm({
      paymentDate: new Date().toISOString().split("T")[0],
      paidAmount: String(Number(installment.cuota_total || 0)),
    });
    setPaymentDialogOpen(true);
  };

  const submitPayment = async () => {
    if (!statement?.loan || !selectedInstallment) return;

    const paidAmount = Number(paymentForm.paidAmount);
    if (!Number.isFinite(paidAmount) || paidAmount <= 0) {
      toast({
        title: "Monto invalido",
        description: "Ingresa un monto pagado mayor que cero.",
        variant: "destructive",
      });
      return;
    }

    try {
      setSavingPayment(true);
      await registerInstallmentPayment(statement.loan.id, selectedInstallment.numero_cuota, {
        paymentDate: paymentForm.paymentDate,
        paidAmount,
      });
      setPaymentDialogOpen(false);
      setSelectedInstallment(null);
      toast({
        title: "Pago registrado",
        description: `La cuota ${selectedInstallment.numero_cuota} ahora figura como cancelada.`,
      });
      await loadStatement();
    } catch (error) {
      toast({
        title: "No se pudo registrar el pago",
        description: error instanceof Error ? error.message : "Intenta nuevamente.",
        variant: "destructive",
      });
    } finally {
      setSavingPayment(false);
    }
  };

  const amortizationRows = useMemo(() => statement?.amortization || [], [statement]);
  const summary = useMemo(() => {
    const canceladas = amortizationRows.filter(
      (row) => normalizeInstallmentStatus(row.estado) === "Cancelada",
    );
    const pendientes = amortizationRows.filter(
      (row) => normalizeInstallmentStatus(row.estado) === "Pendiente",
    );

    return {
      canceladas: canceladas.length,
      pendientes: pendientes.length,
      totalCancelado: canceladas.reduce(
        (acc, row) => acc + Number(row.monto_pagado ?? row.cuota_total ?? 0),
        0,
      ),
      totalPendiente: pendientes.reduce(
        (acc, row) => acc + Number(row.cuota_total ?? 0),
        0,
      ),
    };
  }, [amortizationRows]);

  const buildStatementCsv = () => {
    if (!statement?.loan || amortizationRows.length === 0) return null;

    return [
      ["Credito", statement.loan.codigo || ""].map(escapeCsvValue).join(","),
      ["Cliente", statement.loan.cliente_nombre || ""].map(escapeCsvValue).join(","),
      "",
      [
        "Cuota",
        "Fecha vencimiento",
        "Capital",
        "Interes",
        "Cuota total",
        "Saldo",
        "Estado",
        "Fecha pago",
        "Monto pagado",
      ].join(","),
      ...amortizationRows.map((row) =>
        [
          String(row.numero_cuota),
          row.fecha_vencimiento ? new Date(row.fecha_vencimiento).toLocaleDateString("es-NI") : "",
          currency.format(Number(row.capital || 0)),
          currency.format(Number(row.interes || 0)),
          currency.format(Number(row.cuota_total || 0)),
          currency.format(Number(row.saldo_capital || 0)),
          normalizeInstallmentStatus(row.estado),
          row.fecha_pago ? new Date(row.fecha_pago).toLocaleDateString("es-NI") : "",
          row.monto_pagado ? currency.format(Number(row.monto_pagado || 0)) : "",
        ]
          .map((value) => escapeCsvValue(String(value)))
          .join(","),
      ),
    ].join("\n");
  };

  const buildStatementShareText = () => {
    if (!statement?.loan) return "";

    return [
      `Estado de cuenta Credia`,
      `Credito: ${statement.loan.codigo || "-"}`,
      `Cliente: ${statement.loan.cliente_nombre || "-"}`,
      `Cuotas canceladas: ${summary.canceladas}`,
      `Cuotas pendientes: ${summary.pendientes}`,
      `Total cancelado: ${currency.format(summary.totalCancelado)}`,
      `Total pendiente: ${currency.format(summary.totalPendiente)}`,
    ].join("\n");
  };

  const downloadStatementCsv = () => {
    if (amortizationRows.length === 0 || !statement?.loan) return;

    const csv = buildStatementCsv();
    if (!csv) return;

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `estado-cuenta-${statement.loan.codigo || "credito"}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const shareStatement = async () => {
    if (!statement?.loan || amortizationRows.length === 0) return;

    const csv = buildStatementCsv();
    if (!csv || !navigator.share) {
      toast({
        title: "Compartir no disponible",
        description: "Tu navegador no soporta compartir archivos directamente.",
        variant: "destructive",
      });
      return;
    }

    const fileName = `estado-cuenta-${statement.loan.codigo || "credito"}.csv`;
    const file = new File([csv], fileName, { type: "text/csv;charset=utf-8;" });

    try {
      const shareData = {
        title: "Estado de cuenta Credia",
        text: buildStatementShareText(),
        files: [file],
      };

      if (navigator.canShare && !navigator.canShare({ files: [file] })) {
        throw new Error("FILES_NOT_SUPPORTED");
      }

      await navigator.share(shareData);
    } catch (error) {
      if (error instanceof Error && error.message === "FILES_NOT_SUPPORTED") {
        toast({
          title: "Compartir archivo no disponible",
          description: "Puedes usar Descargar y luego adjuntarlo manualmente.",
          variant: "destructive",
        });
        return;
      }

      if (error instanceof Error && error.name === "AbortError") {
        return;
      }

      toast({
        title: "No se pudo compartir",
        description: "Intenta descargar el archivo o usar WhatsApp, Telegram o Correo.",
        variant: "destructive",
      });
    }
  };

  const shareViaWhatsApp = () => {
    const text = buildStatementShareText();
    if (!text) return;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
  };

  const shareViaTelegram = () => {
    const text = buildStatementShareText();
    if (!text) return;
    window.open(`https://t.me/share/url?url=&text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
  };

  const shareViaEmail = () => {
    const text = buildStatementShareText();
    if (!text || !statement?.loan) return;

    const subject = `Estado de cuenta ${statement.loan.codigo || "Credito"}`;
    const body = `${text}\n\nAdjunta el archivo CSV descargado si deseas enviar el detalle completo por correo.`;
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  const printStatement = () => {
    if (amortizationRows.length === 0 || !statement?.loan) return;

    const rowsHtml = amortizationRows
      .map(
        (row) => `
          <tr>
            <td>${row.numero_cuota}</td>
            <td>${escapeHtml(row.fecha_vencimiento ? new Date(row.fecha_vencimiento).toLocaleDateString("es-NI") : "")}</td>
            <td>${escapeHtml(currency.format(Number(row.capital || 0)))}</td>
            <td>${escapeHtml(currency.format(Number(row.interes || 0)))}</td>
            <td>${escapeHtml(currency.format(Number(row.cuota_total || 0)))}</td>
            <td>${escapeHtml(currency.format(Number(row.saldo_capital || 0)))}</td>
            <td>${escapeHtml(normalizeInstallmentStatus(row.estado))}</td>
            <td>${escapeHtml(row.fecha_pago ? new Date(row.fecha_pago).toLocaleDateString("es-NI") : "")}</td>
            <td>${escapeHtml(row.monto_pagado ? currency.format(Number(row.monto_pagado || 0)) : "")}</td>
          </tr>`,
      )
      .join("");

    const html = `
      <!DOCTYPE html>
      <html lang="es">
        <head>
          <meta charset="UTF-8" />
          <title>Estado de cuenta</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 24px; color: #111827; }
            h1 { font-size: 22px; margin-bottom: 6px; }
            .meta { margin-bottom: 18px; color: #4b5563; font-size: 14px; }
            .summary { display: flex; gap: 12px; margin-bottom: 18px; }
            .box { border: 1px solid #d1d5db; padding: 10px 12px; min-width: 180px; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; }
            th, td { border: 1px solid #d1d5db; padding: 8px; text-align: left; }
            th { background: #f3f4f6; }
          </style>
        </head>
        <body>
          <h1>Estado de cuenta</h1>
          <div class="meta">
            Credito: ${escapeHtml(statement.loan.codigo || "")}<br />
            Cliente: ${escapeHtml(statement.loan.cliente_nombre || "")}
          </div>
          <div class="summary">
            <div class="box">Cuotas canceladas: ${summary.canceladas}</div>
            <div class="box">Cuotas pendientes: ${summary.pendientes}</div>
            <div class="box">Total cancelado: ${escapeHtml(currency.format(summary.totalCancelado))}</div>
            <div class="box">Total pendiente: ${escapeHtml(currency.format(summary.totalPendiente))}</div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Cuota</th>
                <th>Fecha vencimiento</th>
                <th>Capital</th>
                <th>Interes</th>
                <th>Cuota total</th>
                <th>Saldo</th>
                <th>Estado</th>
                <th>Fecha pago</th>
                <th>Monto pagado</th>
              </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
          </table>
        </body>
      </html>
    `;

    const printWindow = window.open("", "_blank", "width=1200,height=900");
    if (!printWindow) return;
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  return (
    <AppLayout
      title="Reporteria"
      subtitle="Estado de cuenta por credito con cuotas canceladas y pendientes"
    >
      <div className="space-y-6">
        <Card className="border-gray-200 shadow-xl">
          <CardHeader>
            <CardTitle>Generar estado de cuenta</CardTitle>
            <CardDescription>
              Selecciona un credito aprobado para ver su amortizacion y estado de cuotas.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 md:flex-row md:items-end">
            <div className="w-full md:max-w-xl">
              <Label>Credito aprobado</Label>
              <Select value={selectedLoanId} onValueChange={setSelectedLoanId}>
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      loadingOptions ? "Cargando creditos..." : "Selecciona un credito"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {loanOptions.map((loan) => (
                    <SelectItem key={loan.id} value={String(loan.id)}>
                      {loan.codigo} - {loan.cliente_nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="border-gray-300"
                onClick={shareStatement}
                disabled={!statement?.loan || amortizationRows.length === 0}
              >
                <Share2 className="mr-2 h-4 w-4" />
                Compartir
              </Button>
              <Button
                type="button"
                variant="outline"
                className="border-gray-300"
                onClick={printStatement}
                disabled={!statement?.loan || amortizationRows.length === 0}
              >
                Imprimir
              </Button>
              <Button
                type="button"
                variant="outline"
                className="border-gray-300"
                onClick={downloadStatementCsv}
                disabled={!statement?.loan || amortizationRows.length === 0}
              >
                Descargar
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-gray-200 shadow-xl">
          <CardHeader>
            <CardTitle>Compartir en aplicaciones</CardTitle>
            <CardDescription>
              Comparte el resumen del estado de cuenta por WhatsApp, Telegram o Correo.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              className="border-gray-300"
              onClick={shareViaWhatsApp}
              disabled={!statement?.loan || amortizationRows.length === 0}
            >
              <Send className="mr-2 h-4 w-4" />
              WhatsApp
            </Button>
            <Button
              type="button"
              variant="outline"
              className="border-gray-300"
              onClick={shareViaTelegram}
              disabled={!statement?.loan || amortizationRows.length === 0}
            >
              <Send className="mr-2 h-4 w-4" />
              Telegram
            </Button>
            <Button
              type="button"
              variant="outline"
              className="border-gray-300"
              onClick={shareViaEmail}
              disabled={!statement?.loan || amortizationRows.length === 0}
            >
              <Mail className="mr-2 h-4 w-4" />
              Correo
            </Button>
          </CardContent>
        </Card>

        {statement?.loan && (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Card className="border-gray-200 shadow-xl">
              <CardContent className="p-5">
                <p className="text-sm text-gray-500">Credito</p>
                <p className="mt-1 text-xl font-bold text-gray-900">
                  {statement.loan.codigo || "-"}
                </p>
              </CardContent>
            </Card>
            <Card className="border-gray-200 shadow-xl">
              <CardContent className="p-5">
                <p className="text-sm text-gray-500">Cuotas canceladas</p>
                <p className="mt-1 text-xl font-bold text-emerald-700">{summary.canceladas}</p>
              </CardContent>
            </Card>
            <Card className="border-gray-200 shadow-xl">
              <CardContent className="p-5">
                <p className="text-sm text-gray-500">Cuotas pendientes</p>
                <p className="mt-1 text-xl font-bold text-amber-700">{summary.pendientes}</p>
              </CardContent>
            </Card>
            <Card className="border-gray-200 shadow-xl">
              <CardContent className="p-5">
                <p className="text-sm text-gray-500">Saldo pendiente</p>
                <p className="mt-1 text-xl font-bold text-gray-900">
                  {currency.format(summary.totalPendiente)}
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        <Card className="border-gray-200 shadow-xl">
          <CardHeader>
            <CardTitle>Detalle de cuotas</CardTitle>
            <CardDescription>
              Estado de cuenta con visibilidad por cuota para seguimiento y reporte.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingStatement ? (
              <p className="text-sm text-gray-500">Cargando estado de cuenta...</p>
            ) : amortizationRows.length === 0 ? (
              <p className="text-sm text-gray-500">
                Selecciona un credito aprobado para ver su estado de cuenta.
              </p>
            ) : (
              <div className="rounded-md border border-gray-200">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cuota</TableHead>
                      <TableHead>Fecha vencimiento</TableHead>
                      <TableHead className="text-right">Capital</TableHead>
                      <TableHead className="text-right">Interes</TableHead>
                      <TableHead className="text-right">Cuota total</TableHead>
                      <TableHead className="text-right">Saldo</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Fecha pago</TableHead>
                      <TableHead className="text-right">Monto pagado</TableHead>
                      <TableHead className="text-right">Accion</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {amortizationRows.map((row) => {
                      const normalizedStatus = normalizeInstallmentStatus(row.estado);
                      return (
                        <TableRow key={`${row.numero_cuota}-${row.fecha_vencimiento}`}>
                          <TableCell>{row.numero_cuota}</TableCell>
                          <TableCell>
                            {row.fecha_vencimiento
                              ? new Date(row.fecha_vencimiento).toLocaleDateString("es-NI")
                              : "-"}
                          </TableCell>
                          <TableCell className="text-right">
                            {currency.format(Number(row.capital || 0))}
                          </TableCell>
                          <TableCell className="text-right">
                            {currency.format(Number(row.interes || 0))}
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {currency.format(Number(row.cuota_total || 0))}
                          </TableCell>
                          <TableCell className="text-right">
                            {currency.format(Number(row.saldo_capital || 0))}
                          </TableCell>
                          <TableCell>
                            <span className={`rounded-full px-2 py-1 text-xs font-medium ${statusClassName(row.estado)}`}>
                              {normalizedStatus}
                            </span>
                          </TableCell>
                          <TableCell>
                            {row.fecha_pago
                              ? new Date(row.fecha_pago).toLocaleDateString("es-NI")
                              : "-"}
                          </TableCell>
                          <TableCell className="text-right">
                            {row.monto_pagado
                              ? currency.format(Number(row.monto_pagado || 0))
                              : "-"}
                          </TableCell>
                          <TableCell className="text-right">
                            {canRegisterPayments && normalizedStatus === "Pendiente" ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="border-gray-300"
                                onClick={() => openPaymentDialog(row)}
                              >
                                Registrar pago
                              </Button>
                            ) : (
                              <span className="text-xs text-gray-400">-</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar pago de cuota</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="text-sm text-gray-600">
              {selectedInstallment ? (
                <>
                  Cuota {selectedInstallment.numero_cuota} por{" "}
                  <strong>{currency.format(Number(selectedInstallment.cuota_total || 0))}</strong>
                </>
              ) : null}
            </div>
            <div>
              <Label>Fecha de pago</Label>
              <Input
                type="date"
                value={paymentForm.paymentDate}
                onChange={(event) =>
                  setPaymentForm((prev) => ({ ...prev, paymentDate: event.target.value }))
                }
              />
            </div>
            <div>
              <Label>Monto pagado</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={paymentForm.paidAmount}
                onChange={(event) =>
                  setPaymentForm((prev) => ({ ...prev, paidAmount: event.target.value }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="border-gray-300"
              onClick={() => setPaymentDialogOpen(false)}
            >
              Cancelar
            </Button>
            <Button type="button" onClick={submitPayment} disabled={savingPayment}>
              {savingPayment ? "Guardando..." : "Confirmar pago"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default Reports;

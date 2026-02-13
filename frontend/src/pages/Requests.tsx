import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { approveLoan, getLoans, rejectLoan } from '@/lib/dashboardApi';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';

interface LoanRow {
  id: number;
  codigo: string;
  cliente_nombre: string;
  cliente_email?: string;
  tipo_credito: string;
  monto_solicitado: number;
  tasa_interes: number;
  plazo_meses: number;
  estado: 'PENDIENTE' | 'APROBADO' | 'RECHAZADO' | string;
  fecha_solicitud: string;
  fecha_aprobacion?: string;
  asesor_nombre?: string;
  cuota_referencial?: number;
}

const currencyFormatter = new Intl.NumberFormat('es-NI', {
  style: 'currency',
  currency: 'NIO',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const STATUS_OPTIONS = [
  { value: 'TODOS', label: 'Todos' },
  { value: 'PENDIENTE', label: 'Pendientes' },
  { value: 'APROBADO', label: 'Aprobados' },
  { value: 'RECHAZADO', label: 'Rechazados' },
];

const statusBadgeClass = (status: string) => {
  switch (status) {
    case 'APROBADO':
      return 'bg-green-100 text-green-800';
    case 'RECHAZADO':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-yellow-100 text-yellow-800';
  }
};

const Requests = () => {
  const [rows, setRows] = useState<LoanRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('TODOS');

  const [selectedLoan, setSelectedLoan] = useState<LoanRow | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  const [showRejectionDialog, setShowRejectionDialog] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  const loadLoans = useCallback(async () => {
    try {
      setLoading(true);
      const status = statusFilter === 'TODOS' ? undefined : statusFilter;
      const response = await getLoans(status);
      setRows(response.loans || []);
    } catch (error) {
      console.error('Error cargando solicitudes:', error);
      toast({
        title: 'Error',
        description: 'No se pudieron cargar las solicitudes',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    loadLoans();
  }, [loadLoans]);

  const filteredRows = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    if (!normalizedSearch) {
      return rows;
    }

    return rows.filter((loan) => {
      return (
        loan.codigo?.toLowerCase().includes(normalizedSearch) ||
        loan.cliente_nombre?.toLowerCase().includes(normalizedSearch) ||
        loan.cliente_email?.toLowerCase().includes(normalizedSearch) ||
        loan.tipo_credito?.toLowerCase().includes(normalizedSearch)
      );
    });
  }, [rows, search]);

  const onApprove = async () => {
    if (!selectedLoan) return;

    try {
      await approveLoan(selectedLoan.id, {});
      toast({
        title: 'Credito aprobado',
        description: `La solicitud ${selectedLoan.codigo} fue aprobada`,
      });
      setShowApprovalDialog(false);
      setSelectedLoan(null);
      await loadLoans();
    } catch (error) {
      console.error('Error aprobando:', error);
      toast({
        title: 'Error',
        description: 'No se pudo aprobar la solicitud',
        variant: 'destructive',
      });
    }
  };

  const onReject = async () => {
    if (!selectedLoan || !rejectionReason.trim()) return;

    try {
      await rejectLoan(selectedLoan.id, { rejectionReason });
      toast({
        title: 'Credito rechazado',
        description: `La solicitud ${selectedLoan.codigo} fue rechazada`,
      });
      setShowRejectionDialog(false);
      setSelectedLoan(null);
      setRejectionReason('');
      await loadLoans();
    } catch (error) {
      console.error('Error rechazando:', error);
      toast({
        title: 'Error',
        description: 'No se pudo rechazar la solicitud',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-widest text-muted-foreground">Gestion de Creditos</p>
            <h1 className="text-3xl font-semibold text-foreground">Solicitudes</h1>
          </div>
          <Button asChild variant="outline">
            <Link to="/dashboard">Volver al dashboard</Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-8">
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col gap-3 md:flex-row">
              <Input
                placeholder="Buscar por codigo, cliente, email o tipo"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full md:w-56">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={loadLoans} disabled={loading}>
                {loading ? 'Actualizando...' : 'Actualizar'}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Solicitudes ({filteredRows.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Codigo</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                    <TableHead className="text-right">Tasa</TableHead>
                    <TableHead className="text-right">Plazo</TableHead>
                    <TableHead className="text-right">Cuota Ref.</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRows.map((loan) => (
                    <TableRow key={loan.id}>
                      <TableCell className="font-medium">{loan.codigo}</TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <p className="font-medium">{loan.cliente_nombre}</p>
                          <p className="text-muted-foreground">{loan.cliente_email || '-'}</p>
                        </div>
                      </TableCell>
                      <TableCell>{loan.tipo_credito}</TableCell>
                      <TableCell className="text-right">{currencyFormatter.format(loan.monto_solicitado)}</TableCell>
                      <TableCell className="text-right">{loan.tasa_interes.toFixed(2)}%</TableCell>
                      <TableCell className="text-right">{loan.plazo_meses}</TableCell>
                      <TableCell className="text-right">
                        {currencyFormatter.format(loan.cuota_referencial ?? 0)}
                      </TableCell>
                      <TableCell>
                        <span className={`rounded-full px-2 py-1 text-xs font-medium ${statusBadgeClass(loan.estado)}`}>
                          {loan.estado}
                        </span>
                      </TableCell>
                      <TableCell>{new Date(loan.fecha_solicitud).toLocaleDateString('es-NI')}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedLoan(loan);
                              setShowDetailsDialog(true);
                            }}
                          >
                            Ver
                          </Button>
                          {loan.estado === 'PENDIENTE' && (
                            <>
                              <Button
                                size="sm"
                                onClick={() => {
                                  setSelectedLoan(loan);
                                  setShowApprovalDialog(true);
                                }}
                              >
                                Aprobar
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => {
                                  setSelectedLoan(loan);
                                  setShowRejectionDialog(true);
                                }}
                              >
                                Rechazar
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!loading && filteredRows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center text-muted-foreground">
                        No hay resultados para los filtros actuales.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </main>

      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Detalle de solicitud</DialogTitle>
          </DialogHeader>
          {selectedLoan && (
            <div className="grid gap-3 text-sm">
              <div>
                <Label>Codigo</Label>
                <p>{selectedLoan.codigo}</p>
              </div>
              <div>
                <Label>Cliente</Label>
                <p>{selectedLoan.cliente_nombre}</p>
              </div>
              <div>
                <Label>Email</Label>
                <p>{selectedLoan.cliente_email || '-'}</p>
              </div>
              <div>
                <Label>Tipo</Label>
                <p>{selectedLoan.tipo_credito}</p>
              </div>
              <div>
                <Label>Monto solicitado</Label>
                <p>{currencyFormatter.format(selectedLoan.monto_solicitado)}</p>
              </div>
              <div>
                <Label>Tasa</Label>
                <p>{selectedLoan.tasa_interes.toFixed(2)}%</p>
              </div>
              <div>
                <Label>Plazo</Label>
                <p>{selectedLoan.plazo_meses} meses</p>
              </div>
              <div>
                <Label>Cuota referencial</Label>
                <p>{currencyFormatter.format(selectedLoan.cuota_referencial ?? 0)}</p>
              </div>
              <div>
                <Label>Asesor</Label>
                <p>{selectedLoan.asesor_nombre || '-'}</p>
              </div>
              <div>
                <Label>Estado</Label>
                <p>{selectedLoan.estado}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showApprovalDialog} onOpenChange={setShowApprovalDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Aprobar solicitud</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Se aprobara la solicitud {selectedLoan?.codigo} por {currencyFormatter.format(selectedLoan?.monto_solicitado ?? 0)}.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowApprovalDialog(false)}>
                Cancelar
              </Button>
              <Button onClick={onApprove}>Confirmar aprobacion</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showRejectionDialog} onOpenChange={setShowRejectionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rechazar solicitud</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="rejectionReason">Motivo</Label>
              <Textarea
                id="rejectionReason"
                value={rejectionReason}
                onChange={(event) => setRejectionReason(event.target.value)}
                rows={4}
                placeholder="Escribe el motivo del rechazo"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowRejectionDialog(false)}>
                Cancelar
              </Button>
              <Button variant="destructive" onClick={onReject} disabled={!rejectionReason.trim()}>
                Confirmar rechazo
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Requests;

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { getLoans, approveLoan, rejectLoan } from "@/lib/dashboardApi";
import { toast } from "@/hooks/use-toast";
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
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  ClipboardList,
  Eye,
  CheckCircle,
  XCircle,
  Search,
  RefreshCw,
  Clock,
  AlertCircle
} from "lucide-react";

interface Loan {
  id: number;
  client_id: number;
  client_name: string;
  email: string;
  loan_type: string;
  amount_requested: number;
  amount_approved?: number;
  term_months: number;
  annual_interest_rate: number;
  monthly_payment: number;
  status: 'pending' | 'approved' | 'rejected' | 'active' | 'completed' | 'defaulted';
  created_at: string;
  approval_date?: string;
  advisor_name: string;
}

const Requests = () => {
  const { user } = useAuth();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [filteredLoans, setFilteredLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  const [showRejectionDialog, setShowRejectionDialog] = useState(false);
  const [approvalAmount, setApprovalAmount] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');

  const loadLoans = async () => {
    try {
      setLoading(true);
      const data = await getLoans(statusFilter === 'all' ? undefined : statusFilter);
      setLoans(data.loans || []);
    } catch (error) {
      console.error('Error cargando préstamos:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar las solicitudes",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLoans();
  }, [statusFilter]);

  useEffect(() => {
    const filtered = loans.filter(loan => 
      loan.client_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      loan.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      loan.loan_type.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredLoans(filtered);
  }, [loans, searchTerm]);

  const handleApprove = async () => {
    if (!selectedLoan || !approvalAmount) return;

    try {
      await approveLoan(selectedLoan.id, {
        amountApproved: parseFloat(approvalAmount)
      });
      
      toast({
        title: "¡Préstamo Aprobado!",
        description: "El préstamo ha sido aprobado exitosamente",
      });
      
      setShowApprovalDialog(false);
      setApprovalAmount('');
      loadLoans();
    } catch (error) {
      console.error('Error aprobando préstamo:', error);
      toast({
        title: "Error",
        description: "No se pudo aprobar el préstamo",
        variant: "destructive",
      });
    }
  };

  const handleReject = async () => {
    if (!selectedLoan || !rejectionReason) return;

    try {
      await rejectLoan(selectedLoan.id, {
        rejectionReason
      });
      
      toast({
        title: "Préstamo Rechazado",
        description: "El préstamo ha sido rechazado",
      });
      
      setShowRejectionDialog(false);
      setRejectionReason('');
      loadLoans();
    } catch (error) {
      console.error('Error rechazando préstamo:', error);
      toast({
        title: "Error",
        description: "No se pudo rechazar el préstamo",
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { color: 'bg-yellow-100 text-yellow-800', icon: Clock, text: 'Pendiente' },
      approved: { color: 'bg-green-100 text-green-800', icon: CheckCircle, text: 'Aprobado' },
      rejected: { color: 'bg-red-100 text-red-800', icon: XCircle, text: 'Rechazado' },
      active: { color: 'bg-blue-100 text-blue-800', icon: CheckCircle, text: 'Activo' },
      completed: { color: 'bg-gray-100 text-gray-800', icon: CheckCircle, text: 'Completado' },
      defaulted: { color: 'bg-red-100 text-red-800', icon: AlertCircle, text: 'Incumplido' }
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
    const Icon = config.icon;

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
        <Icon size={12} className="mr-1" />
        {config.text}
      </span>
    );
  };

  const formatCurrency = (amount: number, currency: string = 'C$') => {
    return `${currency} ${amount.toLocaleString('es-NI', { minimumFractionDigits: 2 })}`;
  };

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-widest text-muted-foreground">
              Gestión de Préstamos
            </p>
            <h1 className="text-3xl font-semibold text-foreground">
              Solicitudes de Crédito
            </h1>
          </div>
          <Button asChild variant="outline">
            <Link to="/dashboard">Volver al dashboard</Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-10">
        {/* Filtros */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por cliente, email o tipo..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="pending">Pendientes</SelectItem>
                    <SelectItem value="approved">Aprobados</SelectItem>
                    <SelectItem value="rejected">Rechazados</SelectItem>
                    <SelectItem value="active">Activos</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" onClick={loadLoans} disabled={loading}>
                  <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabla de solicitudes */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-primary" />
              Solicitudes ({filteredLoans.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="h-6 w-6 animate-spin" />
                <span className="ml-2">Cargando solicitudes...</span>
              </div>
            ) : filteredLoans.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No hay solicitudes que coincidan con los filtros</p>
              </div>
            ) : (
              <div className="rounded-xl border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Monto Solicitado</TableHead>
                      <TableHead>Monto Aprobado</TableHead>
                      <TableHead>Plazo</TableHead>
                      <TableHead>Tasa</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLoans.map((loan) => (
                      <TableRow key={loan.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{loan.client_name}</div>
                            <div className="text-sm text-muted-foreground">{loan.email}</div>
                          </div>
                        </TableCell>
                        <TableCell className="capitalize">{loan.loan_type}</TableCell>
                        <TableCell>{formatCurrency(loan.amount_requested)}</TableCell>
                        <TableCell>
                          {loan.amount_approved 
                            ? formatCurrency(loan.amount_approved)
                            : '-'
                          }
                        </TableCell>
                        <TableCell>{loan.term_months} meses</TableCell>
                        <TableCell>{loan.annual_interest_rate}%</TableCell>
                        <TableCell>{getStatusBadge(loan.status)}</TableCell>
                        <TableCell>
                          {new Date(loan.created_at).toLocaleDateString('es-NI')}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => {
                                setSelectedLoan(loan);
                                setShowDetailsDialog(true);
                              }}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {loan.status === 'pending' && (
                              <>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => {
                                    setSelectedLoan(loan);
                                    setApprovalAmount(loan.amount_requested.toString());
                                    setShowApprovalDialog(true);
                                  }}
                                  className="text-green-600 hover:text-green-700"
                                >
                                  <CheckCircle className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => {
                                    setSelectedLoan(loan);
                                    setShowRejectionDialog(true);
                                  }}
                                  className="text-red-600 hover:text-red-700"
                                >
                                  <XCircle className="h-4 w-4" />
                                </Button>
                              </>
                            )}
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

      {/* Dialog de detalles */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalles de la Solicitud</DialogTitle>
          </DialogHeader>
          {selectedLoan && (
            <div className="grid gap-4 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Cliente</Label>
                  <p className="font-medium">{selectedLoan.client_name}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Email</Label>
                  <p className="font-medium">{selectedLoan.email}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Tipo de Préstamo</Label>
                  <p className="font-medium capitalize">{selectedLoan.loan_type}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Asesor</Label>
                  <p className="font-medium">{selectedLoan.advisor_name}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Monto Solicitado</Label>
                  <p className="font-medium">{formatCurrency(selectedLoan.amount_requested)}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Monto Aprobado</Label>
                  <p className="font-medium">
                    {selectedLoan.amount_approved 
                      ? formatCurrency(selectedLoan.amount_approved)
                      : 'Pendiente'
                    }
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Plazo</Label>
                  <p className="font-medium">{selectedLoan.term_months} meses</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Tasa Anual</Label>
                  <p className="font-medium">{selectedLoan.annual_interest_rate}%</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Cuota Mensual</Label>
                  <p className="font-medium">{formatCurrency(selectedLoan.monthly_payment)}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Estado</Label>
                  <div className="mt-1">{getStatusBadge(selectedLoan.status)}</div>
                </div>
                <div>
                  <Label className="text-muted-foreground">Fecha Solicitud</Label>
                  <p className="font-medium">
                    {new Date(selectedLoan.created_at).toLocaleDateString('es-NI')}
                  </p>
                </div>
                {selectedLoan.approval_date && (
                  <div>
                    <Label className="text-muted-foreground">Fecha Aprobación</Label>
                    <p className="font-medium">
                      {new Date(selectedLoan.approval_date).toLocaleDateString('es-NI')}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog de aprobación */}
      <Dialog open={showApprovalDialog} onOpenChange={setShowApprovalDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Aprobar Préstamo</DialogTitle>
          </DialogHeader>
          {selectedLoan && (
            <div className="space-y-4">
              <div>
                <Label className="text-muted-foreground">Cliente</Label>
                <p className="font-medium">{selectedLoan.client_name}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Monto Solicitado</Label>
                <p className="font-medium">{formatCurrency(selectedLoan.amount_requested)}</p>
              </div>
              <div>
                <Label htmlFor="approvalAmount">Monto a Aprobar</Label>
                <Input
                  id="approvalAmount"
                  type="number"
                  value={approvalAmount}
                  onChange={(e) => setApprovalAmount(e.target.value)}
                  placeholder="Ingrese el monto a aprobar"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowApprovalDialog(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleApprove} disabled={!approvalAmount}>
                  Aprobar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog de rechazo */}
      <Dialog open={showRejectionDialog} onOpenChange={setShowRejectionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rechazar Préstamo</DialogTitle>
          </DialogHeader>
          {selectedLoan && (
            <div className="space-y-4">
              <div>
                <Label className="text-muted-foreground">Cliente</Label>
                <p className="font-medium">{selectedLoan.client_name}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Monto Solicitado</Label>
                <p className="font-medium">{formatCurrency(selectedLoan.amount_requested)}</p>
              </div>
              <div>
                <Label htmlFor="rejectionReason">Motivo del Rechazo</Label>
                <Textarea
                  id="rejectionReason"
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Ingrese el motivo del rechazo..."
                  rows={3}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowRejectionDialog(false)}>
                  Cancelar
                </Button>
                <Button 
                  variant="destructive" 
                  onClick={handleReject} 
                  disabled={!rejectionReason}
                >
                  Rechazar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Requests;
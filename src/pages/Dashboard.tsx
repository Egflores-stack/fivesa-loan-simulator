import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calculator, ClipboardList, LogOut, UserCircle2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calculator, LogOut, Settings, UserCircle2 } from "lucide-react";
import {
  AlertTriangle,
  Calculator,
  CircleDollarSign,
  LogOut,
  Percent,
  UserCircle2,
  WalletCards,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { fetchSummary, SummaryResponse } from "@/lib/summaryApi";
import { formatCurrency, formatPercent } from "@/lib/loanCalculations";

const kpiMeta = [
  {
    key: "disbursements",
    label: "Desembolsos",
    helper: "Últimos 30 días",
    icon: CircleDollarSign,
    format: formatCurrency,
  },
  {
    key: "portfolio",
    label: "Cartera",
    helper: "Saldo vigente",
    icon: WalletCards,
    format: formatCurrency,
  },
  {
    key: "delinquency",
    label: "Mora",
    helper: "Cartera vencida",
    icon: AlertTriangle,
    format: formatPercent,
  },
  {
    key: "index",
    label: "Índice",
    helper: "Índice de desempeño",
    icon: Percent,
    format: (value: number) => value.toFixed(2),
  },
] as const;

const Dashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(true);

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  useEffect(() => {
    let isMounted = true;

    const loadSummary = async () => {
      try {
        const data = await fetchSummary();
        if (isMounted) {
          setSummary(data);
        }
      } catch (error) {
        if (isMounted) {
          setSummaryError(
            error instanceof Error
              ? error.message
              : "No se pudo cargar el resumen."
          );
        }
      } finally {
        if (isMounted) {
          setLoadingSummary(false);
        }
      }
    };

    loadSummary();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-widest text-muted-foreground">
              Panel principal
            </p>
            <h1 className="text-3xl font-semibold text-foreground">Dashboard</h1>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2 rounded-full bg-muted px-3 py-1 text-sm text-muted-foreground">
              <UserCircle2 className="h-4 w-4" />
              <span>{user?.email}</span>
            </div>
            <Button variant="outline" onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              Cerrar sesión
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-6 px-4 py-10 md:grid-cols-2">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Calculator className="h-5 w-5 text-primary" />
              Simulador de crédito
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Ingresa al simulador para calcular cuotas, comparar plazos y
              visualizar el detalle de amortización.
            </p>
            <Button asChild>
              <Link to="/simulator">Ir al simulador</Link>
            </Button>
          </CardContent>
        </Card>

      <main className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-10">
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {kpiMeta.map((kpi) => {
            const Icon = kpi.icon;
            const value =
              summary?.kpis?.[kpi.key] ?? (loadingSummary ? 0 : null);

            return (
              <Card key={kpi.key} className="shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <div>
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      {kpi.label}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground">
                      {kpi.helper}
                    </p>
                  </div>
                  <div className="rounded-full bg-primary/10 p-2 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-semibold text-foreground">
                    {value === null
                      ? "--"
                      : kpi.format(value)}
                  </p>
                  {summaryError ? (
                    <p className="mt-2 text-xs text-destructive">
                      {summaryError}
                    </p>
                  ) : null}
                </CardContent>
              </Card>
            );
          })}
        </section>

        {user?.role === "Administrador" ? (
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Settings className="h-5 w-5 text-primary" />
                Configuración
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Administra usuarios, roles y parámetros de mora desde el panel
                de configuración.
              </p>
              <Button asChild variant="outline">
                <Link to="/config">Ir a configuración</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
        <Card className="border-dashed bg-card/60">
          <CardHeader>
            <CardTitle className="text-xl">Próximamente</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Aquí podrás revisar aprobaciones y reportes cuando los siguientes
              módulos estén listos.
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <ClipboardList className="h-5 w-5 text-primary" />
              Solicitudes de crédito
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Registra solicitudes nuevas o de refinanciamiento y gestiona el
              listado de pendientes.
            </p>
            <Button asChild>
              <Link to="/requests">Ir a solicitudes</Link>
            </Button>
          </CardContent>
        </Card>
        <section className="rounded-xl border border-border bg-card shadow-sm">
          <div className="flex flex-col gap-2 border-b border-border px-6 py-4">
            <h2 className="text-lg font-semibold text-foreground">
              Totales generales por mes
            </h2>
            <p className="text-sm text-muted-foreground">
              Seguimiento mensual de desembolsos, cartera, mora e índice.
            </p>
          </CardContent>
        </Card>
        )}
          </div>
          <div className="overflow-x-auto p-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mes</TableHead>
                  <TableHead className="text-right">Desembolsos</TableHead>
                  <TableHead className="text-right">Cartera</TableHead>
                  <TableHead className="text-right">Mora</TableHead>
                  <TableHead className="text-right">Índice</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(summary?.monthlyTotals ?? []).map((row) => (
                  <TableRow key={row.month}>
                    <TableCell className="font-medium text-foreground">
                      {row.month}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(row.disbursements)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(row.portfolio)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatPercent(row.delinquency)}
                    </TableCell>
                    <TableCell className="text-right">
                      {row.index.toFixed(2)}
                    </TableCell>
                  </TableRow>
                ))}
                {!loadingSummary && summary?.monthlyTotals?.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="py-8 text-center text-sm text-muted-foreground"
                    >
                      No hay datos disponibles.
                    </TableCell>
                  </TableRow>
                ) : null}
                {loadingSummary ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="py-8 text-center text-sm text-muted-foreground"
                    >
                      Cargando resumen...
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>
        </section>

        <section className="grid gap-6 md:grid-cols-2">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Calculator className="h-5 w-5 text-primary" />
                Simulador de crédito
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Ingresa al simulador para calcular cuotas, comparar plazos y
                visualizar el detalle de amortización.
              </p>
              <Button asChild>
                <Link to="/simulator">Ir al simulador</Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="border-dashed bg-card/60">
            <CardHeader>
              <CardTitle className="text-xl">Próximamente</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Aquí podrás administrar solicitudes y revisar historial cuando la
                integración con PostgreSQL esté completa.
              </p>
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
};

export default Dashboard;

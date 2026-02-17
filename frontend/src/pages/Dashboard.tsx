import { useEffect, useMemo, useState } from "react";
import { FileText, TrendingUp, Users, Wallet } from "lucide-react";
import { getDashboardStats } from "@/lib/dashboardApi";
import { toast } from "@/hooks/use-toast";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type StatsCard = {
  title: string;
  value: string;
  icon: string;
};

type RecentRequest = {
  id: number;
  cliente: string;
  monto: number;
  plazo: string;
  fecha: string;
  estado: string;
};

type DashboardPayload = {
  statsCards?: StatsCard[];
  recentRequests?: RecentRequest[];
};

const currencyFormatter = new Intl.NumberFormat("es-NI", {
  style: "currency",
  currency: "NIO",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const iconMap = {
  Users: Users,
  FileText: FileText,
  DollarSign: Wallet,
  TrendingUp: TrendingUp,
} as const;

const statusClass = (status: string) => {
  if (status === "APROBADO") return "bg-emerald-100 text-emerald-700";
  if (status === "RECHAZADO") return "bg-red-100 text-red-700";
  return "bg-amber-100 text-amber-700";
};

const Dashboard = () => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashboardPayload>({});

  const loadData = async () => {
    try {
      setLoading(true);
      const dashboardData = await getDashboardStats();
      setData(dashboardData);
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudieron cargar los datos del dashboard",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const cards = useMemo(() => data.statsCards ?? [], [data.statsCards]);
  const recent = useMemo(() => data.recentRequests ?? [], [data.recentRequests]);

  return (
    <AppLayout
      title="Dashboard"
      subtitle="Resumen de cartera, solicitudes y actividad comercial"
    >
      <div className="space-y-6">
        <div className="flex justify-end">
          <Button
            variant="outline"
            className="border-cyan-300 text-cyan-700 hover:bg-cyan-50"
            onClick={loadData}
            disabled={loading}
          >
            {loading ? "Actualizando..." : "Actualizar"}
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {cards.map((card, idx) => {
            const Icon = iconMap[card.icon as keyof typeof iconMap] ?? FileText;
            return (
              <Card key={`${card.title}-${idx}`} className="border-gray-200 shadow-xl">
                <CardContent className="p-5">
                  <div className="mb-3 inline-flex rounded-xl bg-gradient-to-r from-cyan-100 to-blue-100 p-2.5">
                    <Icon className="h-5 w-5 text-cyan-700" />
                  </div>
                  <p className="text-sm text-gray-500">{card.title}</p>
                  <p className="mt-1 text-2xl font-bold text-gray-900">{card.value}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card className="border-gray-200 shadow-xl">
          <CardHeader>
            <CardTitle className="text-gray-900">Solicitudes recientes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px]">
                <thead>
                  <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wider text-gray-500">
                    <th className="px-2 py-3">Cliente</th>
                    <th className="px-2 py-3 text-right">Monto</th>
                    <th className="px-2 py-3">Plazo</th>
                    <th className="px-2 py-3">Fecha</th>
                    <th className="px-2 py-3">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((item) => (
                    <tr key={item.id} className="border-b border-gray-50 text-sm">
                      <td className="px-2 py-3 font-medium text-gray-900">{item.cliente}</td>
                      <td className="px-2 py-3 text-right text-gray-700">
                        {currencyFormatter.format(item.monto)}
                      </td>
                      <td className="px-2 py-3 text-gray-700">{item.plazo}</td>
                      <td className="px-2 py-3 text-gray-700">{item.fecha}</td>
                      <td className="px-2 py-3">
                        <span className={`rounded-full px-2 py-1 text-xs font-semibold ${statusClass(item.estado)}`}>
                          {item.estado}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {!loading && recent.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-2 py-6 text-center text-sm text-gray-500">
                        Sin solicitudes recientes.
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

export default Dashboard;

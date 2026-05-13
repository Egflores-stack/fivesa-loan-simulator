import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, CheckCircle, TrendingDown } from "lucide-react";

const RiskDashboard = () => {
  const { data: riskData, isLoading } = useQuery({
    queryKey: ["risk-metrics"],
    queryFn: async () => {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/dashboard/risk`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      if (!response.ok) throw new Error("Error fetching risk data");
      return response.json();
    },
  });

  if (isLoading) return <AppLayout><div>Cargando métricas de riesgo...</div></AppLayout>;

  return (
    <AppLayout>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard de Riesgo</h1>

        <div className="grid gap-4 md:grid-cols-3">
          {riskData?.portfolioHealth?.map((stat: any) => (
            <Card key={stat.estado}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{stat.estado}</CardTitle>
                {stat.estado === 'Sana' ? <CheckCircle className="h-4 w-4 text-green-500" /> : <AlertCircle className="h-4 w-4 text-red-500" />}
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.cantidad} créditos</div>
                <p className="text-xs text-muted-foreground">
                  Monto: {new Intl.NumberFormat('es-NI', { style: 'currency', currency: 'NIO' }).format(stat.monto_total)}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingDown className="h-5 w-5 text-orange-500" />
              Mora Proyectada (Próximos 30 días)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-orange-600">
              {new Intl.NumberFormat('es-NI', { style: 'currency', currency: 'NIO' }).format(riskData?.projectedMora?.monto_proyectado_30_dias || 0)}
            </div>
            <p className="text-sm text-muted-foreground">
              Basado en {riskData?.projectedMora?.cuotas_proyectadas} cuotas por vencer.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Clientes con Mayor Riesgo (DPD)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {riskData?.riskyClients?.map((client: any) => (
                <div key={client.id} className="flex items-center justify-between border-b pb-2">
                  <div>
                    <p className="font-medium">{client.full_name}</p>
                    <p className="text-sm text-muted-foreground">Crédito #{client.loan_id}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-red-600 font-bold">{client.dpd} Días de Mora</p>
                    <p className="text-xs font-medium">
                      Monto: {new Intl.NumberFormat('es-NI', { style: 'currency', currency: 'NIO' }).format(client.monto_solicitado)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default RiskDashboard;

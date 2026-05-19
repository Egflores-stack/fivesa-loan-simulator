import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, CheckCircle, TrendingDown } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';

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

  const COLORS = ['#10b981', '#f59e0b', '#ef4444'];
  const chartData = riskData?.portfolioHealth?.map((item: any) => ({
    name: item.estado,
    value: Number(item.monto_total)
  })) || [];

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight">Dashboard de Riesgo</h1>
        </div>

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

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Distribución de Salud de Cartera</CardTitle>
            </CardHeader>
            <CardContent className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {chartData.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: any) => new Intl.NumberFormat('es-NI', { style: 'currency', currency: 'NIO' }).format(value)}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Mora vs. Recuperación</CardTitle>
            </CardHeader>
            <CardContent className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={[
                    { name: 'Vencida', monto: riskData?.portfolioHealth?.find((h: any) => h.estado === 'Vencida')?.monto_total || 0 },
                    { name: 'En Riesgo', monto: riskData?.portfolioHealth?.find((h: any) => h.estado === 'En Riesgo')?.monto_total || 0 },
                    { name: 'Recuperado', monto: riskData?.portfolioHealth?.find((h: any) => h.estado === 'Sana')?.monto_total || 0 },
                  ]}
                >
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip
                    formatter={(value: any) => new Intl.NumberFormat('es-NI', { style: 'currency', currency: 'NIO' }).format(value)}
                  />
                  <Bar dataKey="monto" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

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

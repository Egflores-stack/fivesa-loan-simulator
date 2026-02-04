// pages/Dashboard.tsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { getDashboardStats } from '@/lib/dashboardApi';
import { toast } from '@/hooks/use-toast';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, 
  PieChart, Pie, Cell, ResponsiveContainer
} from 'recharts';
import {
  Users,
  FileText,
  DollarSign,
  TrendingUp,
  Clock,
  CheckCircle,
  AlertCircle,
  Download,
  Filter,
  Calendar,
  RefreshCw
} from 'lucide-react';

const Dashboard = () => {
  const { user, logout } = useAuth();
  const [timeRange, setTimeRange] = useState('month');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    statsCards: [],
    loanRequestsData: [],
    loanAmountsData: [],
    recentRequests: []
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const dashboardData = await getDashboardStats();
      setData(dashboardData);
    } catch (error) {
      console.error('Error cargando datos del dashboard:', error);
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
  }, [timeRange]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between">
          <div>
            {/* CORRECCIÓN AQUÍ: Usar email en lugar de name */}
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
              ¡Bienvenido  a Credia, {user?.email || 'Asesor'}!
            </h1>
            <p className="text-gray-600 mt-2">
              Resumen de actividades y métricas del simulador de préstamos
            </p>
          </div>
          
          <div className="flex items-center space-x-4 mt-4 md:mt-0">
            <div className="flex items-center space-x-2">
              <Calendar className="text-gray-400" size={20} />
              <select 
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
                className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="week">Última semana</option>
                <option value="month">Último mes</option>
                <option value="quarter">Último trimestre</option>
                <option value="year">Último año</option>
              </select>
            </div>
            
            <button 
              className="flex items-center space-x-2 bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition"
              onClick={() => loadData()}
              disabled={loading}
            >
              <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
              <span>Refrescar</span>
            </button>
            
            <button 
              className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
              onClick={() => logout()}
            >
              <Download size={18} />
              <span>Exportar Reporte</span>
            </button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {data.statsCards.map((card, index) => (
          <div key={index} className="bg-white rounded-xl shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm">{card.title}</p>
                <p className="text-2xl font-bold mt-2">{card.value}</p>
                <p className="text-green-600 text-sm mt-1 flex items-center">
                  <TrendingUp size={14} className="mr-1" />
                  {card.change} vs anterior
                </p>
              </div>
              <div className={`p-3 rounded-full bg-${card.color}-100 text-${card.color}-600`}>
                {getIcon(card.icon)}
              </div>
            </div>
          </div>
        ))}
      </div>

{/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Gráfico de barras - Solicitudes por mes */}
        <div className="bg-white rounded-xl shadow p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-semibold">Solicitudes por Mes</h2>
            <Filter size={18} className="text-gray-400 cursor-pointer" />
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.loanRequestsData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="aprobados" fill="#10B981" name="Aprobados" />
              <Bar dataKey="rechazados" fill="#EF4444" name="Rechazados" />
              <Bar dataKey="pendientes" fill="#F59E0B" name="Pendientes" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Gráfico de pastel - Distribución por tipo */}
        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="text-lg font-semibold mb-6">Distribución por Tipo de Préstamo</h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={data.loanAmountsData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {data.loanAmountsData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Tabla de solicitudes recientes */}
      <div className="bg-white rounded-xl shadow overflow-hidden">
        <div className="px-6 py-4 border-b">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">Solicitudes Recientes</h2>
            <button className="text-blue-600 hover:text-blue-800 text-sm font-medium">
              Ver todas →
            </button>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Cliente
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Monto
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Plazo
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Fecha
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Estado
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {data.recentRequests.map((request) => (
                <tr key={request.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-900">{request.cliente}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-gray-900">${request.monto.toLocaleString()}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-gray-500">{request.plazo}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-gray-500">{request.fecha}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                      ${request.estado === 'aprobado' ? 'bg-green-100 text-green-800' : 
                        request.estado === 'rechazado' ? 'bg-red-100 text-red-800' : 
                        'bg-yellow-100 text-yellow-800'}`}>
                      {request.estado === 'aprobado' && <CheckCircle size={12} className="mr-1" />}
                      {request.estado === 'rechazado' && <AlertCircle size={12} className="mr-1" />}
                      {request.estado === 'pendiente' && <Clock size={12} className="mr-1" />}
                      {request.estado.charAt(0).toUpperCase() + request.estado.slice(1)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <button className="text-blue-600 hover:text-blue-900 font-medium text-sm">
                      Ver detalles
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl shadow p-6">
          <h3 className="font-semibold mb-4">Acciones Rápidas</h3>
          <div className="space-y-3">
            <button className="w-full text-left p-3 rounded-lg border hover:bg-gray-50 transition">
              Nueva simulación
            </button>
            <button className="w-full text-left p-3 rounded-lg border hover:bg-gray-50 transition">
              Revisar pendientes
            </button>
            <button className="w-full text-left p-3 rounded-lg border hover:bg-gray-50 transition">
              Generar reporte
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow p-6 md:col-span-2">
          <h3 className="font-semibold mb-4">Resumen de Actividad</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Simulaciones realizadas hoy</span>
              <span className="font-semibold">8</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Clientes nuevos este mes</span>
              <span className="font-semibold">12</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Tiempo promedio de respuesta</span>
              <span className="font-semibold">2.4 horas</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Función para obtener el icono correcto
const getIcon = (iconName) => {
  const icons = {
    FileText: <FileText />,
    Users: <Users />,
    DollarSign: <DollarSign />,
    TrendingUp: <TrendingUp />
  };
  return icons[iconName] || <FileText />;
};

export default Dashboard;
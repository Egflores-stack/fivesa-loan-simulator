// pages/Index.tsx
import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Banknote, Cloud, Shield, TrendingUp, Calculator } from "lucide-react";

const Index = () => {
  const { user, isLoading } = useAuth();
  const [showLoader, setShowLoader] = useState(true);

  // Mostrar loader por al menos 1 segundo para mejor experiencia
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowLoader(false);
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  // Mientras carga la autenticación, mostrar pantalla de carga
  if (isLoading || showLoader) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-credia-50 flex flex-col items-center justify-center p-6">
        {/* Logo y marca */}
        <div className="text-center mb-10 animate-fade-in">
          <div className="flex justify-center mb-6">
            <div className="bg-gradient-to-r from-credia-600 to-credia-700 p-4 rounded-2xl shadow-xl animate-pulse">
              <Banknote className="h-12 w-12 text-white" />
            </div>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-3">
            <span className="bg-gradient-to-r from-credia-600 to-credia-800 bg-clip-text text-transparent">
              Credia
            </span>
          </h1>
          <p className="text-gray-600 text-lg">Sistema de Simulación Crediticia</p>
        </div>

        {/* Loader animado */}
        <div className="mb-10">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-credia-600 mx-auto"></div>
        </div>

        {/* Información de carga */}
        <div className="text-center max-w-md">
          <p className="text-gray-500 mb-2">Inicializando sistema seguro...</p>
          <div className="flex items-center justify-center gap-2 text-sm text-gray-400">
            <Shield className="h-4 w-4" />
            <span>Verificando credenciales</span>
            <Cloud className="h-4 w-4" />
          </div>
        </div>

        {/* Características (solo en carga larga) */}
        <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-2xl">
          {[
            { icon: Calculator, text: "Simulación", color: "from-credia-100 to-credia-200" },
            { icon: TrendingUp, text: "Analítica", color: "from-blue-100 to-cyan-100" },
            { icon: Shield, text: "Seguro", color: "from-green-100 to-emerald-100" },
            { icon: Cloud, text: "Cloudix", color: "from-violet-100 to-purple-100" },
          ].map((item, index) => (
            <div 
              key={index} 
              className={`bg-gradient-to-r ${item.color} p-3 rounded-lg text-center animate-pulse`}
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <item.icon className="h-5 w-5 text-gray-600 mx-auto mb-1" />
              <p className="text-xs text-gray-600 font-medium">{item.text}</p>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="absolute bottom-6 text-center">
          <p className="text-xs text-gray-400">
            © {new Date().getFullYear()} Credia v3.0 • 
            <span className="text-credia-600 font-medium mx-1">Cloudix Technologies</span>
          </p>
        </div>
      </div>
    );
  }

  // Si ya está autenticado, redirigir al dashboard
  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  // Si no está autenticado, redirigir al login
  return <Navigate to="/login" replace />;
};

export default Index;
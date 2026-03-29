// App.tsx - Versión completa
import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Simulator from "./pages/Simulator";
import Requests from "./pages/Requests";
import Config from "./pages/Config";
import Clients from "./pages/Clients";
import Reports from "./pages/Reports";
import { AuthProvider } from "@/hooks/useAuth";
import ProtectedRoute from "./components/ProtectedRoute";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const App = () => {
  // Configuración inicial
  useEffect(() => {
    // Título de la página
    document.title = "Credia - Sistema de Simulación Crediticia";
    
    // Favicon dinámico (opcional)
    const favicon = document.querySelector("link[rel*='icon']") as HTMLLinkElement;
    if (favicon) {
      favicon.href = "/favicon.ico";
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              {/* Ruta raíz con pantalla de carga inteligente */}
              <Route path="/" element={<Index />} />
              
              {/* Ruta de login pública */}
              <Route path="/login" element={<Login />} />
              
              {/* Rutas protegidas */}
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                }
              />
              
              <Route
                path="/clients"
                element={
                  <ProtectedRoute>
                    <Clients />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/simulator"
                element={
                  <ProtectedRoute>
                    <Simulator />
                  </ProtectedRoute>
                }
              />
              
              <Route
                path="/requests"
                element={
                  <ProtectedRoute>
                    <Requests />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/requests/new"
                element={
                  <ProtectedRoute>
                    <Requests />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/authorizations"
                element={
                  <ProtectedRoute>
                    <Requests />
                  </ProtectedRoute>
                }
              />
              
              <Route
                path="/config"
                element={
                  <ProtectedRoute>
                    <Config />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/reports"
                element={
                  <ProtectedRoute>
                    <Reports />
                  </ProtectedRoute>
                }
              />
              
              {/* Ruta 404 - DEBE SER LA ÚLTIMA */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;

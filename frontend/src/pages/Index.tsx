// pages/Index.tsx
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Banknote, Shield, TrendingUp, Calculator, Cloud, ArrowRight } from "lucide-react";

const Index = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-credia-50">
      {/* Header/Navbar */}
      <header className="border-b border-gray-200 bg-white/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="bg-gradient-to-r from-credia-600 to-credia-700 p-2 rounded-lg">
              <Banknote className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Credia</h1>
              <p className="text-xs text-gray-500">Sistema de Simulación Crediticia</p>
            </div>
          </div>
          <Button asChild variant="outline" className="border-credia-200 text-credia-700">
            <Link to="/login">
              Acceso al Sistema
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </header>

      {/* Hero Section */}
      <main className="container mx-auto px-4 py-12 md:py-20">
        <div className="text-center mb-16">
          <div className="inline-flex items-center justify-center p-3 bg-gradient-to-r from-credia-100 to-cyan-100 rounded-2xl mb-6">
            <Banknote className="h-12 w-12 text-credia-600" />
          </div>
          <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6">
            <span className="bg-gradient-to-r from-credia-600 to-credia-800 bg-clip-text text-transparent">
              Credia
            </span>
          </h1>
          <p className="text-xl md:text-2xl text-gray-600 mb-8 max-w-3xl mx-auto">
            Plataforma profesional de análisis y simulación de productos crediticios
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild size="lg" className="bg-gradient-to-r from-credia-600 to-credia-700 hover:from-credia-700 hover:to-credia-800 shadow-lg">
              <Link to="/login">
                Ingresar al Sistema
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="border-credia-300 text-credia-700">
              <a href="#features">
                Conocer Funcionalidades
              </a>
            </Button>
          </div>
        </div>

        {/* Features */}
        <div id="features" className="grid md:grid-cols-3 gap-8 mb-16">
          {[
            {
              icon: Calculator,
              title: "Simulación Avanzada",
              description: "Cálculos precisos de tasas, plazos y cuotas con algoritmos optimizados"
            },
            {
              icon: TrendingUp,
              title: "Dashboard Analítico",
              description: "Métricas financieras en tiempo real y reportes ejecutivos automatizados"
            },
            {
              icon: Shield,
              title: "Seguridad Bancaria",
              description: "Infraestructura Cloudix con encriptación AES-256 y autenticación multifactor"
            }
          ].map((feature, index) => (
            <Card key={index} className="border-credia-100 shadow-sm hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="bg-gradient-to-r from-credia-50 to-cyan-50 p-3 rounded-lg w-fit mb-4">
                  <feature.icon className="h-6 w-6 text-credia-600" />
                </div>
                <CardTitle className="text-gray-900">{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-gray-600">
                  {feature.description}
                </CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Cloudix Branding */}
        <Card className="bg-gradient-to-r from-gray-50 to-credia-50 border-credia-200">
          <CardContent className="p-8">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="bg-gradient-to-r from-credia-600 to-cyan-600 p-3 rounded-xl">
                  <Cloud className="h-8 w-8 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Desarrollado por Cloudix Technologies</h3>
                  <p className="text-gray-600">Patente CLX-CREDIA-2024 • Certificación ISO 27001</p>
                </div>
              </div>
              <div className="text-center md:text-right">
                <p className="text-sm text-gray-500 mb-2">Soporte 24/7</p>
                <Button variant="outline" size="sm" className="border-credia-300 text-credia-700">
                  <a href="mailto:soporte@cloudix.tech">soporte@cloudix.tech</a>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white py-8">
        <div className="container mx-auto px-4">
          <div className="text-center">
            <p className="text-gray-600 mb-2">
              © {new Date().getFullYear()} Credia v3.0 • Plataforma de simulación crediticia
            </p>
            <p className="text-sm text-gray-500">
              Sistema patentado por Cloudix Technologies • Todos los derechos reservados
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
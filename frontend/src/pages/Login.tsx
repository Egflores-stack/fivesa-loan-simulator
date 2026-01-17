// pages/Login.tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, LogIn, Shield, Building, Calculator, TrendingUp, Cloud, Key, Banknote } from 'lucide-react';

const Login = () => {
  const [username, setUsername] = useState('asesor');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Usar username directamente o convertirlo según tu backend
      const loginEmail = username.includes('@') ? username : `${username}@credia.sv`;
      await login(loginEmail, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Usuario o contraseña incorrectos');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-4 flex flex-col md:flex-row items-center justify-center">
      {/* Left side - Brand/Info */}
      <div className="md:w-1/2 max-w-lg p-8 md:p-12">
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="relative">
              <div className="bg-gradient-to-r from-cyan-600 to-blue-600 p-3 rounded-xl shadow-lg">
                <Banknote className="h-8 w-8 text-white" />
              </div>
              <div className="absolute -top-2 -right-2 bg-gradient-to-r from-emerald-500 to-green-500 p-1.5 rounded-full shadow-md">
                <Cloud className="h-4 w-4 text-white" />
              </div>
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-gray-900">
                <span className="bg-gradient-to-r from-cyan-600 to-blue-600 bg-clip-text text-transparent">
                  Credia
                </span>
              </h1>
              <p className="text-lg font-medium text-gray-700 mt-1">
                Sistema de Simulación Crediticia
              </p>
              <p className="text-sm text-gray-500 mt-1">
                Plataforma Cloudix • Versión 3.0
              </p>
            </div>
          </div>
          <p className="text-lg text-gray-600 mb-6 border-l-4 border-cyan-500 pl-4 py-1">
            Solución integral para análisis y simulación de productos crediticios
          </p>
        </div>

        <div className="space-y-8">
          <div className="flex items-start gap-4">
            <div className="bg-gradient-to-r from-cyan-100 to-blue-100 p-3 rounded-xl shadow-sm">
              <Calculator className="h-7 w-7 text-cyan-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-1 text-lg">Simulación Previa</h3>
              <p className="text-gray-600">Cálculos precisos de tasas, plazos y cuotas en tiempo real</p>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className="bg-gradient-to-r from-emerald-100 to-green-100 p-3 rounded-xl shadow-sm">
              <TrendingUp className="h-7 w-7 text-emerald-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-1 text-lg">Dashboard Analítico</h3>
              <p className="text-gray-600">Métricas financieras y reportes ejecutivos automatizados</p>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className="bg-gradient-to-r from-violet-100 to-purple-100 p-3 rounded-xl shadow-sm">
              <Shield className="h-7 w-7 text-violet-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-1 text-lg">Seguridad Garantizada</h3>
              <p className="text-gray-600">Infraestructura Cloudix con encriptación AES-256</p>
            </div>
          </div>
        </div>

        <div className="mt-12 p-5 bg-gradient-to-r from-gray-50 to-blue-50 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="bg-gradient-to-r from-cyan-500 to-blue-500 p-2 rounded-lg">
              <Cloud className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700">
                Desarrollado por Cloudix Technologies
              </p>
              <p className="text-xs text-gray-600 mt-1">
                Patente CLX-CREDIA-2024 • Certificación ISO 27001
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Right side - Login Form */}
      <div className="md:w-1/2 max-w-md w-full">
        <Card className="shadow-2xl border-gray-200">
          <CardHeader className="space-y-2 pb-6">
            <div className="flex justify-center mb-2">
              <div className="bg-gradient-to-r from-cyan-600 to-blue-600 p-4 rounded-full shadow-lg">
                <Key className="h-7 w-7 text-white" />
              </div>
            </div>
            <CardTitle className="text-2xl text-center font-bold text-gray-900">
              Acceso al Sistema
            </CardTitle>
            <CardDescription className="text-center text-gray-600">
              Plataforma Credia v3.0
            </CardDescription>
          </CardHeader>

          <CardContent>
            {error && (
              <Alert variant="destructive" className="mb-6 border-red-200">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="font-medium">{error}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleLogin} className="space-y-5">
              <div className="space-y-2.5">
                <Label htmlFor="username" className="text-gray-700 font-medium flex items-center gap-2">
                  <span className="bg-gray-100 p-1 rounded">
                    <Building className="h-3.5 w-3.5 text-gray-600" />
                  </span>
                  Usuario Institucional
                </Label>
                <div className="relative">
                  <Input
                    id="username"
                    type="text"
                    placeholder="Ingresa tu usuario"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    className="h-12 pl-10 bg-gray-50 border-gray-300 focus:border-cyan-500 focus:ring-cyan-500"
                  />
                  <div className="absolute left-3 top-3.5 text-gray-400">
                    <span className="text-sm font-medium">@</span>
                  </div>
                </div>
                <p className="text-xs text-gray-500">
                  Usuario asignado por el administrador del sistema
                </p>
              </div>

              <div className="space-y-2.5">
                <div className="flex justify-between items-center">
                  <Label htmlFor="password" className="text-gray-700 font-medium flex items-center gap-2">
                    <span className="bg-gray-100 p-1 rounded">
                      <Shield className="h-3.5 w-3.5 text-gray-600" />
                    </span>
                    Contraseña de Acceso
                  </Label>
                  <Button
                    type="button"
                    variant="link"
                    className="px-0 text-cyan-600 hover:text-cyan-800 text-sm font-medium"
                    onClick={() => alert('Contacte al administrador del sistema para restablecer su contraseña')}
                  >
                    ¿Contraseña olvidada?
                  </Button>
                </div>
                <Input
                  id="password"
                  type="password"
                  placeholder="Ingresa tu contraseña"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-12 bg-gray-50 border-gray-300 focus:border-cyan-500 focus:ring-cyan-500"
                />
              </div>

              <div className="flex items-center space-x-2.5 pt-2">
                <input
                  type="checkbox"
                  id="remember"
                  className="h-4 w-4 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500"
                />
                <Label htmlFor="remember" className="text-sm font-normal text-gray-600">
                  Mantener sesión activa
                </Label>
              </div>

              <Button 
                type="submit" 
                className="w-full h-12 text-base font-semibold bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 shadow-md hover:shadow-lg transition-all"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    Verificando credenciales...
                  </>
                ) : (
                  <>
                    <LogIn className="mr-2.5 h-5 w-5" />
                    Ingresar a Credia
                  </>
                )}
              </Button>
            </form>

            <div className="my-8">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-3 bg-white text-gray-500 font-medium">
                    Sistema Certificado
                  </span>
                </div>
              </div>
              <p className="text-center text-xs text-gray-500 mt-4">
                Acceso restringido a personal autorizado.
                <br />
                Toda actividad es monitoreada y registrada.
              </p>
            </div>
          </CardContent>

          <CardFooter className="flex flex-col pt-2 border-t border-gray-100">
            <div className="text-center w-full">
              <div className="inline-flex items-center gap-2 text-xs text-gray-500 mb-3">
                <Shield className="h-3 w-3 text-green-500" />
                <span>Conexión segura • SSL/TLS encriptado</span>
                <Shield className="h-3 w-3 text-green-500" />
              </div>
              <p className="text-xs text-gray-500">
                © {new Date().getFullYear()} Credia v3.0 • 
                <span className="text-cyan-600 font-medium mx-1">Cloudix Technologies</span>
              </p>
              <p className="text-[10px] text-gray-400 mt-1">
                Patente CLX-CREDIA-2024-001 • Todos los derechos reservados
              </p>
            </div>
          </CardFooter>
        </Card>

        <div className="mt-6 text-center">
          <div className="inline-flex items-center gap-2 text-sm text-gray-600 bg-gray-50 px-4 py-2.5 rounded-lg border border-gray-200">
            <Cloud className="h-4 w-4 text-cyan-500" />
            <span>
              Soporte técnico:{' '}
              <Button
                variant="link"
                className="px-1 text-cyan-600 hover:text-cyan-800 text-sm font-medium"
                onClick={() => alert('Soporte Cloudix\nEmail: soporte@cloudix.tech\nTel: (505) 5734-6264\nHorario: 24/7')}
              >
                soporte@cloudix.tech
              </Button>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
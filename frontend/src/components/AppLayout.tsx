import type { ReactNode } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { Banknote, Calculator, FilePlus2, FileText, LayoutDashboard, LogOut, Menu, Users } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

type AppLayoutProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
};

const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/clients", label: "Perfil de Cliente", icon: Users },
  { to: "/simulator", label: "Simulador", icon: Calculator },
  { to: "/requests/new", label: "Nueva Solicitud", icon: FilePlus2 },
  { to: "/requests", label: "Bandeja de Solicitudes", icon: FileText, end: true },
];

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
    isActive
      ? "bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-md"
      : "text-gray-600 hover:bg-cyan-50 hover:text-cyan-700"
  }`;

const SidebarContent = ({ onNavigate }: { onNavigate?: () => void }) => {
  const { logout, user } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="flex h-full flex-col">
      <div className="mb-6 rounded-2xl border border-cyan-100 bg-gradient-to-r from-cyan-50 to-blue-50 p-4">
        <div className="mb-2 inline-flex rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 p-2.5 shadow-md">
          <Banknote className="h-5 w-5 text-white" />
        </div>
        <p className="text-lg font-bold text-gray-900">
          <span className="bg-gradient-to-r from-cyan-600 to-blue-600 bg-clip-text text-transparent">
            Credia
          </span>
        </p>
        <p className="text-xs text-gray-500">Sistema de Simulacion Crediticia</p>
      </div>

      <nav className="space-y-2">
        {navItems.map((item) => (
          <NavLink key={item.to} to={item.to} end={Boolean((item as { end?: boolean }).end)} className={navLinkClass} onClick={onNavigate}>
            <item.icon className="h-4 w-4" />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto border-t border-gray-200 pt-4">
        <p className="mb-3 truncate text-xs text-gray-500">
          {user?.full_name || user?.username || user?.email}
        </p>
        <Button
          variant="outline"
          className="w-full border-gray-300 text-gray-700 hover:bg-gray-50"
          onClick={handleLogout}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Cerrar sesion
        </Button>
      </div>
    </div>
  );
};

const AppLayout = ({ title, subtitle, children }: AppLayoutProps) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      <div className="mx-auto flex min-h-screen max-w-[1400px] gap-6 p-4 md:p-6">
        <aside className="hidden w-72 rounded-2xl border border-gray-200 bg-white p-4 shadow-xl md:block">
          <SidebarContent />
        </aside>

        <div className="flex min-w-0 flex-1 flex-col rounded-2xl border border-gray-200 bg-white shadow-xl">
          <header className="border-b border-gray-100 bg-gradient-to-r from-gray-50 to-blue-50 px-4 py-4 sm:px-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-600">Credia</p>
                <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">{title}</h1>
                {subtitle && <p className="mt-1 text-sm text-gray-600">{subtitle}</p>}
              </div>

              <div className="flex items-center gap-2">
                <Sheet>
                  <SheetTrigger asChild>
                    <Button variant="outline" size="icon" className="md:hidden">
                      <Menu className="h-4 w-4" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="left" className="w-72">
                    <SidebarContent />
                  </SheetContent>
                </Sheet>

                <Button
                  asChild
                  variant="ghost"
                  className="hidden text-cyan-700 hover:bg-cyan-50 hover:text-cyan-800 sm:inline-flex"
                >
                  <Link to="/dashboard">Inicio</Link>
                </Button>
              </div>
            </div>
          </header>

          <main className="flex-1 p-4 sm:p-6">{children}</main>
        </div>
      </div>
    </div>
  );
};

export default AppLayout;

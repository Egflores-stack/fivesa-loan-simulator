import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "@/hooks/use-toast";
import {
  createUser,
  deleteUser,
  fetchParameters,
  fetchUsers,
  type ConfigUser,
  type Parameters,
  updateParameters,
  updateUser,
} from "@/lib/configApi";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";

const roles = ["Administrador", "Asesor"] as const;

const defaultParameters: Parameters = {
  diasMoraVencido: 0,
  cuotasVencido: 0,
};

const Config = () => {
  const { user, token } = useAuth();
  const [users, setUsers] = useState<ConfigUser[]>([]);
  const [parameters, setParameters] = useState<Parameters>(defaultParameters);
  const [loading, setLoading] = useState(true);
  const [savingParameters, setSavingParameters] = useState(false);
  const [creatingUser, setCreatingUser] = useState(false);
  const [userForm, setUserForm] = useState({
    email: "",
    role: roles[1],
    password: "",
  });
  const [editingUser, setEditingUser] = useState<ConfigUser | null>(null);
  const [editForm, setEditForm] = useState({ email: "", role: "", password: "" });

  const isAdmin = user?.role === "Administrador";

  const loadData = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [usersResponse, parametersResponse] = await Promise.all([
        fetchUsers(token),
        fetchParameters(token),
      ]);
      setUsers(usersResponse);
      setParameters(parametersResponse);
    } catch (error) {
      toast({
        title: "No se pudo cargar la configuración",
        description: error instanceof Error ? error.message : "Intenta nuevamente.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token) return;
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const handleParametersChange = (field: keyof Parameters, value: string) => {
    const numericValue = Number(value);
    setParameters((prev) => ({
      ...prev,
      [field]: Number.isNaN(numericValue) ? 0 : numericValue,
    }));
  };

  const handleSaveParameters = async () => {
    if (!token) return;
    setSavingParameters(true);
    try {
      const updated = await updateParameters(parameters, token);
      setParameters(updated);
      toast({ title: "Parámetros actualizados" });
    } catch (error) {
      toast({
        title: "No se pudieron guardar los parámetros",
        description: error instanceof Error ? error.message : "Intenta nuevamente.",
        variant: "destructive",
      });
    } finally {
      setSavingParameters(false);
    }
  };

  const handleCreateUser = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token) return;
    setCreatingUser(true);
    try {
      const createdUser = await createUser(userForm, token);
      setUsers((prev) => [createdUser, ...prev]);
      setUserForm({ email: "", role: roles[1], password: "" });
      toast({ title: "Usuario creado" });
    } catch (error) {
      toast({
        title: "No se pudo crear el usuario",
        description: error instanceof Error ? error.message : "Intenta nuevamente.",
        variant: "destructive",
      });
    } finally {
      setCreatingUser(false);
    }
  };

  const openEditDialog = (configUser: ConfigUser) => {
    setEditingUser(configUser);
    setEditForm({ email: configUser.email, role: configUser.role, password: "" });
  };

  const handleUpdateUser = async () => {
    if (!token || !editingUser) return;
    try {
      const updatedUser = await updateUser(
        editingUser.id,
        {
          email: editForm.email,
          role: editForm.role,
          ...(editForm.password ? { password: editForm.password } : {}),
        },
        token,
      );
      setUsers((prev) => prev.map((item) => (item.id === updatedUser.id ? updatedUser : item)));
      setEditingUser(null);
      toast({ title: "Usuario actualizado" });
    } catch (error) {
      toast({
        title: "No se pudo actualizar el usuario",
        description: error instanceof Error ? error.message : "Intenta nuevamente.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteUser = async (configUser: ConfigUser) => {
    if (!token) return;
    const confirmed = window.confirm(
      `¿Seguro que deseas eliminar el usuario ${configUser.email}?`,
    );
    if (!confirmed) return;
    try {
      await deleteUser(configUser.id, token);
      setUsers((prev) => prev.filter((item) => item.id !== configUser.id));
      toast({ title: "Usuario eliminado" });
    } catch (error) {
      toast({
        title: "No se pudo eliminar el usuario",
        description: error instanceof Error ? error.message : "Intenta nuevamente.",
        variant: "destructive",
      });
    }
  };

  const usersEmpty = useMemo(() => users.length === 0, [users]);

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-widest text-muted-foreground">
              Configuración
            </p>
            <h1 className="text-3xl font-semibold text-foreground">
              Administración
            </h1>
          </div>
          <Button variant="outline" asChild>
            <Link to="/dashboard">Volver al dashboard</Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10">
        {!isAdmin ? (
          <Card>
            <CardHeader>
              <CardTitle>Acceso restringido</CardTitle>
              <CardDescription>
                Solo los usuarios administradores pueden gestionar usuarios y
                parámetros.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Parámetros de mora</CardTitle>
                <CardDescription>
                  Ajusta los días y cuotas vencidas que se consideran en el
                  simulador.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-[repeat(2,minmax(0,1fr))_auto] md:items-end">
                <div>
                  <label className="text-sm font-medium text-foreground">
                    Días de mora vencido
                  </label>
                  <Input
                    type="number"
                    min={0}
                    value={parameters.diasMoraVencido}
                    onChange={(event) =>
                      handleParametersChange("diasMoraVencido", event.target.value)
                    }
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground">
                    Cuotas vencidas
                  </label>
                  <Input
                    type="number"
                    min={0}
                    value={parameters.cuotasVencido}
                    onChange={(event) =>
                      handleParametersChange("cuotasVencido", event.target.value)
                    }
                  />
                </div>
                <div className="md:justify-self-end">
                  <Button onClick={handleSaveParameters} disabled={savingParameters}>
                    {savingParameters ? "Guardando..." : "Guardar cambios"}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Separator />

            <Card>
              <CardHeader>
                <CardTitle>Usuarios</CardTitle>
                <CardDescription>
                  Crea, edita y elimina accesos para el equipo comercial.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <form
                  className="grid gap-4 rounded-lg border border-dashed p-4 md:grid-cols-[2fr_1fr_1fr_auto] md:items-end"
                  onSubmit={handleCreateUser}
                >
                  <div>
                    <label className="text-sm font-medium text-foreground">Email</label>
                    <Input
                      type="email"
                      placeholder="usuario@fivesa.com"
                      value={userForm.email}
                      onChange={(event) =>
                        setUserForm((prev) => ({ ...prev, email: event.target.value }))
                      }
                      required
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground">Rol</label>
                    <Select
                      value={userForm.role}
                      onValueChange={(value) =>
                        setUserForm((prev) => ({ ...prev, role: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona un rol" />
                      </SelectTrigger>
                      <SelectContent>
                        {roles.map((role) => (
                          <SelectItem key={role} value={role}>
                            {role}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground">
                      Contraseña temporal
                    </label>
                    <Input
                      type="password"
                      value={userForm.password}
                      onChange={(event) =>
                        setUserForm((prev) => ({ ...prev, password: event.target.value }))
                      }
                      required
                    />
                  </div>
                  <Button type="submit" disabled={creatingUser}>
                    {creatingUser ? "Creando..." : "Agregar"}
                  </Button>
                </form>

                <div className="rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Email</TableHead>
                        <TableHead>Rol</TableHead>
                        <TableHead>Alta</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loading ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-muted-foreground">
                            Cargando usuarios...
                          </TableCell>
                        </TableRow>
                      ) : usersEmpty ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-muted-foreground">
                            No hay usuarios registrados.
                          </TableCell>
                        </TableRow>
                      ) : (
                        users.map((configUser) => (
                          <TableRow key={configUser.id}>
                            <TableCell>{configUser.email}</TableCell>
                            <TableCell>{configUser.role}</TableCell>
                            <TableCell>
                              {new Date(configUser.created_at).toLocaleDateString("es-CO")}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex flex-wrap justify-end gap-2">
                                <Dialog
                                  open={editingUser?.id === configUser.id}
                                  onOpenChange={(open) =>
                                    setEditingUser(open ? configUser : null)
                                  }
                                >
                                  <DialogTrigger asChild>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => openEditDialog(configUser)}
                                    >
                                      Editar
                                    </Button>
                                  </DialogTrigger>
                                  <DialogContent>
                                    <DialogHeader>
                                      <DialogTitle>Editar usuario</DialogTitle>
                                      <DialogDescription>
                                        Actualiza email, rol o contraseña.
                                      </DialogDescription>
                                    </DialogHeader>
                                    <div className="grid gap-4 py-4">
                                      <div>
                                        <label className="text-sm font-medium text-foreground">
                                          Email
                                        </label>
                                        <Input
                                          type="email"
                                          value={editForm.email}
                                          onChange={(event) =>
                                            setEditForm((prev) => ({
                                              ...prev,
                                              email: event.target.value,
                                            }))
                                          }
                                        />
                                      </div>
                                      <div>
                                        <label className="text-sm font-medium text-foreground">
                                          Rol
                                        </label>
                                        <Select
                                          value={editForm.role}
                                          onValueChange={(value) =>
                                            setEditForm((prev) => ({ ...prev, role: value }))
                                          }
                                        >
                                          <SelectTrigger>
                                            <SelectValue placeholder="Selecciona un rol" />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {roles.map((role) => (
                                              <SelectItem key={role} value={role}>
                                                {role}
                                              </SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                      </div>
                                      <div>
                                        <label className="text-sm font-medium text-foreground">
                                          Nueva contraseña (opcional)
                                        </label>
                                        <Input
                                          type="password"
                                          value={editForm.password}
                                          onChange={(event) =>
                                            setEditForm((prev) => ({
                                              ...prev,
                                              password: event.target.value,
                                            }))
                                          }
                                        />
                                      </div>
                                    </div>
                                    <DialogFooter>
                                      <Button onClick={handleUpdateUser}>Guardar cambios</Button>
                                    </DialogFooter>
                                  </DialogContent>
                                </Dialog>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => handleDeleteUser(configUser)}
                                >
                                  Eliminar
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  );
};

export default Config;

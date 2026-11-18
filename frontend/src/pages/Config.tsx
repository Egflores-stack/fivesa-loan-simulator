import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import {
  changeOwnPassword,
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
import { Textarea } from "@/components/ui/textarea";

type UserRole = "Administrador" | "Asesor";
type AccessType = "Demo" | "Alquiler";

const operationalRoles: UserRole[] = ["Asesor"];
const editableRoles: UserRole[] = ["Asesor"];
const accessTypes: AccessType[] = ["Demo", "Alquiler"];

const defaultParameters: Parameters = {
  diasMoraVencido: 0,
  cuotasVencido: 0,
};

const slugify = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase();

const buildSuggestedUsername = (firstName: string, lastName: string) => {
  const firstInitial = slugify(firstName).charAt(0);
  const lastPart = slugify(lastName);
  return `${firstInitial}${lastPart}`.trim();
};

const Config = () => {
  const { user, token } = useAuth();
  const [users, setUsers] = useState<ConfigUser[]>([]);
  const [parameters, setParameters] = useState<Parameters>(defaultParameters);
  const [loading, setLoading] = useState(true);
  const [savingParameters, setSavingParameters] = useState(false);
  const [creatingUser, setCreatingUser] = useState(false);
  const [savingOwnPassword, setSavingOwnPassword] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  
  const [userForm, setUserForm] = useState({
    first_name: "",
    last_name: "",
    username: "",
    email: "",
    company: "",
    access_type: "Demo" as AccessType,
    description: "",
    role: "Asesor" as UserRole,
    password: "",
  });
  
  const [editingUser, setEditingUser] = useState<ConfigUser | null>(null);
  const [editForm, setEditForm] = useState({
    first_name: "",
    last_name: "",
    username: "",
    email: "",
    company: "",
    access_type: "Demo",
    description: "",
    role: "Asesor",
    password: "",
  });

  const isSuperAdmin = Boolean(user?.is_super_admin);

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
    if (!isSuperAdmin) {
      setLoading(false);
      return;
    }
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuperAdmin, token]);

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

  const handleChangeOwnPassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token) return;

    if (!passwordForm.currentPassword || !passwordForm.newPassword) {
      toast({
        title: "Completa los campos requeridos",
        description: "Ingresa tu clave actual y la nueva clave.",
        variant: "destructive",
      });
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      toast({
        title: "Clave demasiado corta",
        description: "La nueva clave debe tener al menos 6 caracteres.",
        variant: "destructive",
      });
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast({
        title: "Las claves no coinciden",
        description: "Confirma nuevamente la nueva clave.",
        variant: "destructive",
      });
      return;
    }

    setSavingOwnPassword(true);
    try {
      await changeOwnPassword(
        {
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
        },
        token,
      );
      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      toast({ title: "Clave actualizada" });
    } catch (error) {
      toast({
        title: "No se pudo actualizar la clave",
        description: error instanceof Error ? error.message : "Intenta nuevamente.",
        variant: "destructive",
      });
    } finally {
      setSavingOwnPassword(false);
    }
  };

  const handleUserFormChange = (field: keyof typeof userForm, value: string) => {
    setUserForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === "first_name" || field === "last_name") {
        next.username = buildSuggestedUsername(
          field === "first_name" ? value : prev.first_name,
          field === "last_name" ? value : prev.last_name,
        );
      }
      return next;
    });
  };

  const handleEditFormChange = (field: keyof typeof editForm, value: string) => {
    setEditForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === "first_name" || field === "last_name") {
        next.username = buildSuggestedUsername(
          field === "first_name" ? value : prev.first_name,
          field === "last_name" ? value : prev.last_name,
        );
      }
      return next;
    });
  };

  const handleCreateUser = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token) return;
    setCreatingUser(true);
    try {
      const createdUser = await createUser(userForm, token);
      setUsers((prev) => [createdUser, ...prev]);
      setUserForm({
        first_name: "",
        last_name: "",
        username: "",
        email: "",
        company: "",
        access_type: "Demo",
        description: "",
        role: "Asesor",
        password: "",
      });
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
    setEditForm({
      first_name: configUser.first_name || "",
      last_name: configUser.last_name || "",
      username: configUser.username || "",
      email: configUser.email || "",
      company: configUser.company || "",
      access_type: configUser.access_type || "Demo",
      description: configUser.description || "",
      role: configUser.role || "Asesor",
      password: ""
    });
  };

  const handleUpdateUser = async () => {
    if (!token || !editingUser) return;
    try {
      const updatedUser = await updateUser(
        editingUser.id,
        {
          first_name: editForm.first_name,
          last_name: editForm.last_name,
          username: editForm.username,
          email: editForm.email,
          company: editForm.company,
          access_type: editForm.access_type,
          description: editForm.description,
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
      `¿Seguro que deseas desactivar el usuario ${configUser.username}?`,
    );
    if (!confirmed) return;
    try {
      await deleteUser(configUser.id, token);
      setUsers((prev) => prev.filter((item) => item.id !== configUser.id));
      toast({ title: "Usuario desactivado" });
    } catch (error) {
      toast({
        title: "No se pudo desactivar el usuario",
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
              Parametrización
            </h1>
          </div>
          <Button variant="outline" asChild>
            <Link to="/dashboard">Volver al dashboard</Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10">
        <Card>
          <CardHeader>
            <CardTitle>Seguridad de acceso</CardTitle>
            <CardDescription>
              Cambia tu clave personal para mantener seguro tu acceso al sistema.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="grid gap-4 md:grid-cols-[repeat(3,minmax(0,1fr))_auto] md:items-end"
              onSubmit={handleChangeOwnPassword}
            >
              <div>
                <label className="text-sm font-medium text-foreground">
                  Clave actual
                </label>
                <Input
                  type="password"
                  value={passwordForm.currentPassword}
                  onChange={(event) =>
                    setPasswordForm((prev) => ({
                      ...prev,
                      currentPassword: event.target.value,
                    }))
                  }
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">
                  Nueva clave
                </label>
                <Input
                  type="password"
                  value={passwordForm.newPassword}
                  onChange={(event) =>
                    setPasswordForm((prev) => ({
                      ...prev,
                      newPassword: event.target.value,
                    }))
                  }
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">
                  Confirmar nueva clave
                </label>
                <Input
                  type="password"
                  value={passwordForm.confirmPassword}
                  onChange={(event) =>
                    setPasswordForm((prev) => ({
                      ...prev,
                      confirmPassword: event.target.value,
                    }))
                  }
                  required
                />
              </div>
              <div className="md:justify-self-end">
                <Button type="submit" disabled={savingOwnPassword}>
                  {savingOwnPassword ? "Guardando..." : "Cambiar clave"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {!isSuperAdmin ? (
          <Card>
            <CardHeader>
              <CardTitle>Acceso restringido</CardTitle>
              <CardDescription>
                Solo el super admin puede parametrizar usuarios y parámetros generales del sistema.
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
                <CardTitle>Parametrización de usuarios</CardTitle>
                <CardDescription>
                  Crea usuarios con nombre, apellido, usuario sugerido, empresa y tipo de acceso.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <form className="space-y-4 rounded-lg border border-dashed p-4" onSubmit={handleCreateUser}>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="text-sm font-medium text-foreground">Nombre</label>
                      <Input
                        value={userForm.first_name}
                        onChange={(event) => handleUserFormChange("first_name", event.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-foreground">Apellido</label>
                      <Input
                        value={userForm.last_name}
                        onChange={(event) => handleUserFormChange("last_name", event.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-foreground">Usuario</label>
                      <Input
                        value={userForm.username}
                        onChange={(event) => handleUserFormChange("username", event.target.value)}
                        placeholder="admin"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-foreground">Email</label>
                      <Input
                        type="email"
                        placeholder="usuario@empresa.com"
                        value={userForm.email}
                        onChange={(event) => handleUserFormChange("email", event.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-foreground">Empresa</label>
                      <Input
                        value={userForm.company}
                        onChange={(event) => handleUserFormChange("company", event.target.value)}
                        placeholder="Empresa / Cliente"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-foreground">Tipo de acceso</label>
                      <Select
                        value={userForm.access_type}
                        onValueChange={(value) => handleUserFormChange("access_type", value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {accessTypes.map((accessType) => (
                            <SelectItem key={accessType} value={accessType}>
                              {accessType}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-foreground">Rol</label>
                      <Select
                        value={userForm.role}
                        onValueChange={(value) => handleUserFormChange("role", value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona un rol" />
                        </SelectTrigger>
                        <SelectContent>
                          {operationalRoles.map((role) => (
                            <SelectItem key={role} value={role}>
                              {role}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-foreground">Contraseña temporal</label>
                      <Input
                        type="password"
                        value={userForm.password}
                        onChange={(event) => handleUserFormChange("password", event.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground">Descripción</label>
                    <Textarea
                      rows={3}
                      value={userForm.description}
                      onChange={(event) => handleUserFormChange("description", event.target.value)}
                      placeholder="Usuario para versión demo o de alquiler"
                    />
                  </div>
                  <div className="flex justify-end">
                    <Button type="submit" disabled={creatingUser}>
                      {creatingUser ? "Creando..." : "Crear usuario"}
                    </Button>
                  </div>
                </form>

                <div className="rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Usuario</TableHead>
                        <TableHead>Nombre</TableHead>
                        <TableHead>Empresa</TableHead>
                        <TableHead>Acceso</TableHead>
                        <TableHead>Rol</TableHead>
                        <TableHead>Alta</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loading ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center text-muted-foreground">
                            Cargando usuarios...
                          </TableCell>
                        </TableRow>
                      ) : usersEmpty ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center text-muted-foreground">
                            No hay usuarios registrados.
                          </TableCell>
                        </TableRow>
                      ) : (
                        users.map((configUser) => (
                          <TableRow key={configUser.id}>
                            <TableCell className="font-medium">{configUser.username}</TableCell>
                            <TableCell>{configUser.full_name || "-"}</TableCell>
                            <TableCell>{configUser.company || "-"}</TableCell>
                            <TableCell>{configUser.access_type || "-"}</TableCell>
                            <TableCell>{configUser.role}</TableCell>
                            <TableCell>
                              {new Date(configUser.created_at).toLocaleDateString("es-NI")}
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
                                  <DialogContent className="max-w-2xl">
                                    <DialogHeader>
                                      <DialogTitle>Editar usuario</DialogTitle>
                                      <DialogDescription>
                                        Ajusta los datos de negocio y acceso del usuario.
                                      </DialogDescription>
                                    </DialogHeader>
                                    <div className="grid gap-4 py-4 md:grid-cols-2">
                                      <div>
                                        <label className="text-sm font-medium text-foreground">
                                          Nombre
                                        </label>
                                        <Input
                                          value={editForm.first_name}
                                          onChange={(event) =>
                                            handleEditFormChange("first_name", event.target.value)
                                          }
                                        />
                                      </div>
                                      <div>
                                        <label className="text-sm font-medium text-foreground">
                                          Apellido
                                        </label>
                                        <Input
                                          value={editForm.last_name}
                                          onChange={(event) =>
                                            handleEditFormChange("last_name", event.target.value)
                                          }
                                        />
                                      </div>
                                      <div>
                                        <label className="text-sm font-medium text-foreground">
                                          Usuario
                                        </label>
                                        <Input
                                          value={editForm.username}
                                          onChange={(event) =>
                                            handleEditFormChange("username", event.target.value)
                                          }
                                        />
                                      </div>
                                      <div>
                                        <label className="text-sm font-medium text-foreground">
                                          Email
                                        </label>
                                        <Input
                                          type="email"
                                          value={editForm.email}
                                          onChange={(event) =>
                                            handleEditFormChange("email", event.target.value)
                                          }
                                        />
                                      </div>
                                      <div>
                                        <label className="text-sm font-medium text-foreground">
                                          Empresa
                                        </label>
                                        <Input
                                          value={editForm.company}
                                          onChange={(event) =>
                                            handleEditFormChange("company", event.target.value)
                                          }
                                        />
                                      </div>
                                      <div>
                                        <label className="text-sm font-medium text-foreground">
                                          Tipo de acceso
                                        </label>
                                        <Select
                                          value={editForm.access_type}
                                          onValueChange={(value) =>
                                            handleEditFormChange("access_type", value)
                                          }
                                        >
                                          <SelectTrigger>
                                            <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {accessTypes.map((accessType) => (
                                              <SelectItem key={accessType} value={accessType}>
                                                {accessType}
                                              </SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                      </div>
                                      <div>
                                        <label className="text-sm font-medium text-foreground">
                                          Rol
                                        </label>
                                        <Select
                                          value={editForm.role}
                                          onValueChange={(value) =>
                                            handleEditFormChange("role", value)
                                          }
                                        >
                                          <SelectTrigger>
                                            <SelectValue placeholder="Selecciona un rol" />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {editableRoles.map((role) => (
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
                                            handleEditFormChange("password", event.target.value)
                                          }
                                        />
                                      </div>
                                      <div className="md:col-span-2">
                                        <label className="text-sm font-medium text-foreground">
                                          Descripción
                                        </label>
                                        <Textarea
                                          rows={3}
                                          value={editForm.description}
                                          onChange={(event) =>
                                            handleEditFormChange("description", event.target.value)
                                          }
                                        />
                                      </div>
                                    </div>
                                    <DialogFooter>
                                      <Button onClick={handleUpdateUser}>Guardar cambios</Button>
                                    </DialogFooter>
                                  </DialogContent>
                                </Dialog>
                                {!configUser.is_super_admin && (
                                  <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={() => handleDeleteUser(configUser)}
                                  >
                                    Desactivar
                                  </Button>
                                )}
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

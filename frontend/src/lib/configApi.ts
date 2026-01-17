const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:3001";

export type ConfigUser = {
  id: string;
  email: string;
  role: string;
  created_at: string;
};

export type Parameters = {
  diasMoraVencido: number;
  cuotasVencido: number;
};

type CreateUserPayload = {
  email: string;
  role: string;
  password: string;
};

type UpdateUserPayload = {
  email?: string;
  role?: string;
  password?: string;
};

const buildHeaders = (token?: string) => ({
  "Content-Type": "application/json",
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
});

const parseError = async (response: Response) => {
  const errorBody = await response.json().catch(() => ({}));
  return errorBody.message || "No se pudo completar la solicitud.";
};

export const fetchUsers = async (token: string): Promise<ConfigUser[]> => {
  const response = await fetch(`${API_BASE_URL}/api/config/users`, {
    headers: buildHeaders(token),
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  const data = (await response.json()) as { users: ConfigUser[] };
  return data.users;
};

export const createUser = async (
  payload: CreateUserPayload,
  token: string,
): Promise<ConfigUser> => {
  const response = await fetch(`${API_BASE_URL}/api/config/users`, {
    method: "POST",
    headers: buildHeaders(token),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  const data = (await response.json()) as { user: ConfigUser };
  return data.user;
};

export const updateUser = async (
  id: string,
  payload: UpdateUserPayload,
  token: string,
): Promise<ConfigUser> => {
  const response = await fetch(`${API_BASE_URL}/api/config/users/${id}`, {
    method: "PATCH",
    headers: buildHeaders(token),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  const data = (await response.json()) as { user: ConfigUser };
  return data.user;
};

export const deleteUser = async (id: string, token: string): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/api/config/users/${id}`, {
    method: "DELETE",
    headers: buildHeaders(token),
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }
};

export const fetchParameters = async (token: string): Promise<Parameters> => {
  const response = await fetch(`${API_BASE_URL}/api/config/parameters`, {
    headers: buildHeaders(token),
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  const data = (await response.json()) as {
    parameters: { dias_mora_vencido: number; cuotas_vencido: number };
  };

  return {
    diasMoraVencido: data.parameters.dias_mora_vencido,
    cuotasVencido: data.parameters.cuotas_vencido,
  };
};

export const updateParameters = async (
  payload: Parameters,
  token: string,
): Promise<Parameters> => {
  const response = await fetch(`${API_BASE_URL}/api/config/parameters`, {
    method: "PUT",
    headers: buildHeaders(token),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  const data = (await response.json()) as {
    parameters: { dias_mora_vencido: number; cuotas_vencido: number };
  };

  return {
    diasMoraVencido: data.parameters.dias_mora_vencido,
    cuotasVencido: data.parameters.cuotas_vencido,
  };
};

export type PostgresUser = {
  id: string;
  email: string;
  role: string;
};

type LoginCredentials = {
  email: string;
  password: string;
};

type AuthResponse = {
  token: string;
  user: PostgresUser;
};

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:3001";

export const loginWithPostgres = async ({
  email,
  password,
}: LoginCredentials): Promise<AuthResponse> => {
  const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.message || "No se pudo iniciar sesión.");
  }

  return (await response.json()) as AuthResponse;
};

export const getCurrentUser = async (token: string): Promise<PostgresUser> => {
  const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error("Sesión inválida.");
  }

  const data = (await response.json()) as { user: PostgresUser };
  return data.user;
};

export const logoutFromPostgres = async (token?: string): Promise<void> => {
  await fetch(`${API_BASE_URL}/api/auth/logout`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  }).catch(() => undefined);
};

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  getCurrentUser,
  loginWithPostgres,
  logoutFromPostgres,
  type PostgresUser,
} from "@/lib/postgresAuth";

type AuthContextValue = {
  user: PostgresUser | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const AUTH_STORAGE_KEY = "fivesa.auth.token";

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<PostgresUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedToken = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!storedToken) {
      setIsLoading(false);
      return;
    }

    setToken(storedToken);

    getCurrentUser(storedToken)
      .then((currentUser) => {
        setUser(currentUser);
      })
      .catch(() => {
        localStorage.removeItem(AUTH_STORAGE_KEY);
        setToken(null);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  const login = async (email: string, password: string) => {
    const { token: nextToken, user: loggedUser } = await loginWithPostgres({
      email,
      password,
    });
    setToken(nextToken);
    setUser(loggedUser);
    localStorage.setItem(AUTH_STORAGE_KEY, nextToken);
  };

  const logout = async () => {
    await logoutFromPostgres(token ?? undefined);
    setUser(null);
    setToken(null);
    localStorage.removeItem(AUTH_STORAGE_KEY);
  };

  const value = useMemo(
    () => ({ user, token, isLoading, login, logout }),
    [user, token, isLoading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

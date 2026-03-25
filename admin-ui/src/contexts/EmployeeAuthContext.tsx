import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { employeeAuthApi, employeeApiClient, type EmployeeUser } from '../lib/employeeApi';

interface EmployeeAuthContextType {
  employee: EmployeeUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const EmployeeAuthContext = createContext<EmployeeAuthContextType | null>(null);

export function EmployeeAuthProvider({ children }: { children: ReactNode }) {
  const [employee, setEmployee] = useState<EmployeeUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadEmployee = useCallback(async () => {
    const token = employeeApiClient.getToken();
    if (!token) {
      setEmployee(null);
      setIsLoading(false);
      return;
    }

    try {
      const data = await employeeAuthApi.me();
      setEmployee(data);
    } catch {
      employeeApiClient.clearToken();
      setEmployee(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEmployee();
  }, [loadEmployee]);

  const login = async (email: string, password: string) => {
    const result = await employeeAuthApi.login(email, password);
    employeeApiClient.setToken(result.token);
    setEmployee(result.employee);
  };

  const logout = async () => {
    try {
      await employeeAuthApi.logout();
    } catch {
      // Ignorer erreur
    }
    employeeApiClient.clearToken();
    setEmployee(null);
  };

  return (
    <EmployeeAuthContext.Provider
      value={{
        employee,
        isLoading,
        isAuthenticated: !!employee,
        login,
        logout,
      }}
    >
      {children}
    </EmployeeAuthContext.Provider>
  );
}

export function useEmployeeAuth() {
  const context = useContext(EmployeeAuthContext);
  if (!context) {
    throw new Error('useEmployeeAuth must be used within EmployeeAuthProvider');
  }
  return context;
}

import React from 'react';

// ===================== Toast =====================
export interface ToastContextValue {
  msg: string | null;
  toast: (m: string) => void;
}
export const ToastContext = React.createContext<ToastContextValue>({ msg: null, toast: () => {} });
export const useToast = () => React.useContext(ToastContext);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [msg, setMsg] = React.useState<string | null>(null);
  const timer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const toast = React.useCallback((m: string) => {
    setMsg(m);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setMsg(null), 1700);
  }, []);
  React.useEffect(() => () => clearTimeout(timer.current), []);
  return <ToastContext.Provider value={{ msg, toast }}>{children}</ToastContext.Provider>;
}

// ===================== Auth (booted) =====================
export interface AuthContextValue {
  booted: boolean;
  enter: () => void;
  logout: () => void | Promise<void>;
}
export const AuthContext = React.createContext<AuthContextValue>({ booted: false, enter: () => {}, logout: () => {} });
export const useAuth = () => React.useContext(AuthContext);

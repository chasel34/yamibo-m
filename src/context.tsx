import React from 'react';

// ===================== Toast =====================
// The stable dispatcher and the changing message live in SEPARATE contexts: every
// screen pulls `toast` (via useNav), but only the ToastLayer overlay needs `msg`.
// Splitting them means showing/hiding a toast re-renders just ToastLayer instead of
// every mounted screen (which a single {msg,toast} value would force on each toast).
type ToastFn = (m: string) => void;
const ToastDispatchContext = React.createContext<ToastFn>(() => {});
const ToastMessageContext = React.createContext<string | null>(null);
export const useToast = () => ({ toast: React.useContext(ToastDispatchContext) });
export const useToastMessage = () => React.useContext(ToastMessageContext);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [msg, setMsg] = React.useState<string | null>(null);
  const timer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const toast = React.useCallback((m: string) => {
    setMsg(m);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setMsg(null), 1700);
  }, []);
  React.useEffect(() => () => clearTimeout(timer.current), []);
  return (
    <ToastDispatchContext.Provider value={toast}>
      <ToastMessageContext.Provider value={msg}>{children}</ToastMessageContext.Provider>
    </ToastDispatchContext.Provider>
  );
}

// ===================== Auth (booted) =====================
export interface AuthContextValue {
  booted: boolean;
  enter: () => void;
  logout: () => void | Promise<void>;
}
export const AuthContext = React.createContext<AuthContextValue>({ booted: false, enter: () => {}, logout: () => {} });
export const useAuth = () => React.useContext(AuthContext);

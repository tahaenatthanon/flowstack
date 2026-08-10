/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface ConfirmOptions {
  title?: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'default' | 'destructive';
}

interface ConfirmState extends Required<ConfirmOptions> {
  open: boolean;
  resolve: (value: boolean) => void;
}

const DEFAULTS = {
  title: 'ยืนยันการดำเนินการ',
  description: '',
  confirmLabel: 'ยืนยัน',
  cancelLabel: 'ยกเลิก',
  variant: 'default' as const,
};

interface ConfirmContextValue {
  confirm: (options?: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ConfirmState | null>(null);

  const confirm = useCallback((options: ConfirmOptions = {}): Promise<boolean> => {
    return new Promise((resolve) => {
      setState({ ...DEFAULTS, ...options, open: true, resolve });
    });
  }, []);

  const handleClose = useCallback((value: boolean) => {
    if (state) {
      state.resolve(value);
      setState(null);
    }
  }, [state]);

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      <AlertDialog open={!!state} onOpenChange={(open) => { if (!open) handleClose(false); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{state?.title}</AlertDialogTitle>
            {state?.description && (
              <AlertDialogDescription>{state.description}</AlertDialogDescription>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => handleClose(false)}>
              {state?.cancelLabel}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleClose(true)}
              className={state?.variant === 'destructive' ? 'bg-destructive hover:bg-destructive/90' : ''}
            >
              {state?.confirmLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmContextValue {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used within <ConfirmProvider>');
  return ctx;
}

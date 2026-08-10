import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  children: ReactNode;
  /** Optional label shown in the error box (e.g. "Leaderboard") */
  section?: string;
  /** Render a compact inline error instead of a full-page box */
  inline?: boolean;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Post to client-error log if available; fire-and-forget
    try {
      const apiBase = (window as any).__API_BASE__ ?? '/flowstack/api';
      fetch(`${apiBase}/client-errors.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          section: this.props.section ?? 'unknown',
          message: error.message,
          stack: error.stack?.slice(0, 800),
          component_stack: info.componentStack?.slice(0, 800),
        }),
        keepalive: true,
      }).catch(() => {});
    } catch (_) {}
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    const { section, inline } = this.props;
    const label = section ? `"${section}"` : 'ส่วนนี้';

    if (inline) {
      return (
        <div className="flex items-center gap-2 rounded border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>เกิดข้อผิดพลาดใน {label}</span>
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto h-6 px-2 text-xs"
            onClick={() => this.setState({ hasError: false, error: null })}
          >
            ลองใหม่
          </Button>
        </div>
      );
    }

    return (
      <div className="flex min-h-[200px] flex-col items-center justify-center gap-4 rounded-lg border border-destructive/30 bg-destructive/5 p-8 text-center">
        <AlertTriangle className="h-10 w-10 text-destructive" />
        <div>
          <p className="font-semibold text-destructive">เกิดข้อผิดพลาดใน {label}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            ส่วนอื่นของหน้ายังทำงานได้ตามปกติ
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => this.setState({ hasError: false, error: null })}
        >
          ลองใหม่
        </Button>
      </div>
    );
  }
}

export default ErrorBoundary;

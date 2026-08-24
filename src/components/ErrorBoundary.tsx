import React, { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RotateCcw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught component error:', error, errorInfo);
  }

  private handleReload = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    } else {
      window.location.reload();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="bg-white rounded-3xl border border-rose-200 p-8 shadow-xs text-center space-y-4 max-w-xl mx-auto my-8">
          <div className="w-14 h-14 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto border border-rose-100 shadow-2xs">
            <AlertTriangle className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-slate-800">
              เกิดข้อผิดพลาดในการแสดงผลหน้านี้
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              ระบบป้องกันปัญหาจอขาวอัตโนมัติ กรุณากดปุ่มด้านล่างเพื่อโหลดข้อมูลใหม่
            </p>
          </div>
          {this.state.error && (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] font-mono text-slate-600 text-left overflow-x-auto max-h-32">
              {this.state.error.message}
            </div>
          )}
          <div className="flex items-center justify-center space-x-3 pt-2">
            <button
              type="button"
              onClick={this.handleReload}
              className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center space-x-2 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>โหลดหน้านี้ใหม่</span>
            </button>
            <button
              type="button"
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all flex items-center space-x-1.5 cursor-pointer"
            >
              <Home className="w-4 h-4" />
              <span>รีเฟรชระบบ</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

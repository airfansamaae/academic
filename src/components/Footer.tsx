import React from 'react';
import { ShieldCheck, Cloud, CheckCircle2 } from 'lucide-react';
import { SystemSettings } from '../types';

interface FooterProps {
  settings: SystemSettings;
}

export const Footer: React.FC<FooterProps> = ({ settings }) => {
  return (
    <footer className="mt-12 border-t border-slate-200/80 bg-white/90 backdrop-blur-md py-8 text-xs text-slate-500">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-center md:text-left">
          {/* Left Text */}
          <div className="space-y-1">
            <p className="font-bold text-slate-700">{settings.footerText}</p>
            <p className="text-slate-400">
              สถานศึกษา: <span className="text-slate-600 font-semibold">{settings.schoolName}</span>
            </p>
          </div>

          {/* Right Storage Badges */}
          <div className="flex flex-wrap items-center justify-center gap-2">
            <div className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200/80 text-slate-600 text-xs font-medium">
              <Cloud className="w-3.5 h-3.5 text-emerald-600" />
              <span>Cloud Storage Connected</span>
            </div>
            <div className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200/80 text-slate-600 text-xs font-medium">
              <CheckCircle2 className="w-3.5 h-3.5 text-purple-600" />
              <span>Database Active</span>
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-400 gap-2">
          <p>Academic Task & Submission Management System</p>
          <div className="flex items-center space-x-1 text-slate-500 font-medium">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Secure Cloud Architecture • Automated Backend Sync</span>
          </div>
        </div>
      </div>
    </footer>
  );
};

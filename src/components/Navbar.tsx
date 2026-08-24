import React from 'react';
import {
  School,
  Settings,
  LogOut,
  User as UserIcon,
  ShieldCheck,
  HardDrive,
  Database,
  CloudCheck,
} from 'lucide-react';
import { User, SystemSettings } from '../types';
import { CLOUDFLARE_DB_ID } from '../services/storage';

interface NavbarProps {
  currentUser: User | null;
  settings: SystemSettings;
  onOpenSettings: () => void;
  onLogout: () => void;
  onOpenAuth: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentUser,
  settings,
  onOpenSettings,
  onLogout,
  onOpenAuth,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 flex-shrink-0 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-18">
          {/* Brand & School Logo (Geometric Balance style) */}
          <div className="flex items-center space-x-3 sm:space-x-4">
            <div className="flex items-center gap-2.5">
              {settings.schoolLogoUrl ? (
                <img
                  src={settings.schoolLogoUrl}
                  alt={settings.schoolName}
                  className="w-9 h-9 rounded-xl object-cover ring-1 ring-slate-200 shadow-xs shrink-0"
                  onError={(e) => {
                    (e.currentTarget as HTMLElement).style.display = 'none';
                  }}
                />
              ) : (
                <div className="w-9 h-9 bg-purple-600 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-sm shrink-0">
                  A
                </div>
              )}
              <div>
                <div className="flex items-center space-x-1.5">
                  <h1 className="text-base sm:text-lg font-bold tracking-tight text-slate-800 leading-tight">
                    ACADEMIC <span className="text-purple-600">SYSTEM</span>
                  </h1>
                </div>
                <p className="text-[11px] text-slate-400 font-medium line-clamp-1">
                  {settings.schoolName}
                </p>
              </div>
            </div>
          </div>

          {/* Center System Status Pill (Geometric Balance) */}
          <div className="hidden md:flex items-center space-x-3 text-xs text-slate-500 bg-slate-50/80 border border-slate-200/90 px-3.5 py-1.5 rounded-full">
            <div className="flex items-center space-x-1.5 text-emerald-600 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <CloudCheck className="w-3.5 h-3.5" />
              <span>ฐานข้อมูลและระบบจัดเก็บออนไลน์พร้อมใช้งาน</span>
            </div>
          </div>

          {/* Right Action Controls: User status + Geometric Buttons */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            {currentUser ? (
              <>
                {/* User Info Geometric Capsule with clear green verified badge */}
                <div className="flex items-center space-x-2.5 bg-emerald-50/70 hover:bg-emerald-50 border border-emerald-200/90 pl-2 pr-3 py-1.5 rounded-xl transition-colors shadow-2xs">
                  <img
                    src={currentUser.avatarUrl}
                    alt={currentUser.fullName}
                    className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg object-cover ring-2 ring-emerald-500/40"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src =
                        'https://api.dicebear.com/7.x/bottts/svg?seed=user';
                    }}
                  />
                  <div className="text-left hidden sm:block">
                    <p className="text-xs font-bold text-slate-800 leading-tight">
                      {currentUser.fullName}
                    </p>
                    <div className="flex items-center space-x-1">
                      <ShieldCheck className="w-3 h-3 text-emerald-600 shrink-0" />
                      {currentUser.role === 'ADMIN' ? (
                        <span className="text-[10px] font-bold text-emerald-700">
                          เข้าสู่ระบบแล้ว (Admin)
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-emerald-700">
                          เข้าสู่ระบบแล้ว (สมาชิก)
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Settings Button */}
                <button
                  id="btn-navbar-settings"
                  onClick={onOpenSettings}
                  title="ตั้งค่าระบบและจัดการข้อมูล"
                  className="flex items-center space-x-1.5 px-3 py-1.5 sm:py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer border border-slate-200/60"
                >
                  <Settings className="w-3.5 h-3.5 text-slate-600" />
                  <span className="hidden md:inline">ตั้งค่าระบบ</span>
                </button>

                {/* Logout Button */}
                <button
                  id="btn-navbar-logout"
                  onClick={onLogout}
                  title="ออกจากระบบ"
                  className="flex items-center space-x-1.5 px-3 py-1.5 sm:py-2 text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors cursor-pointer border border-rose-200/60"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden md:inline">ออกจากระบบ</span>
                </button>
              </>
            ) : (
              <button
                id="btn-navbar-login"
                onClick={onOpenAuth}
                className="btn-glow-purple flex items-center space-x-2 px-4 py-2 text-xs sm:text-sm font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-xl transition-all cursor-pointer shadow-xs"
              >
                <UserIcon className="w-4 h-4" />
                <span>เข้าสู่ระบบ / ลงทะเบียน</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

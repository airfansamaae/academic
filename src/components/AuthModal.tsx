import React, { useState } from 'react';
import {
  LogIn,
  UserPlus,
  KeyRound,
  School,
  User as UserIcon,
  ShieldCheck,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  X,
} from 'lucide-react';
import { StorageService } from '../services/storage';
import {
  notifySuccess,
  notifyError,
  notifyWarning,
} from '../services/notifications';

interface AuthModalProps {
  isOpen: boolean;
  onClose?: () => void;
  onLoginSuccess: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
}) => {
  if (!isOpen) return null;

  const [mode, setMode] = useState<'LOGIN' | 'REGISTER'>('LOGIN');

  // Login Form
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Register Form
  const [regFullName, setRegFullName] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regSchool, setRegSchool] = useState('');

  // Quick bypass Master Admin
  const handleQuickMasterAdmin = () => {
    setLoginUsername('Admin');
    setLoginPassword('456789');
    const res = StorageService.login('Admin', '456789');
    if (res.success) {
      notifySuccess('เข้าสู่ระบบสำเร็จในฐานะ Master Admin');
      onLoginSuccess();
      if (onClose) onClose();
    }
  };

  // Quick login sample teacher
  const handleQuickTeacher = () => {
    setLoginUsername('teacher_somchai');
    setLoginPassword('password123');
    const res = StorageService.login('teacher_somchai', 'password123');
    if (res.success) {
      notifySuccess(`ยินดีต้อนรับ ${res.user?.fullName}`);
      onLoginSuccess();
      if (onClose) onClose();
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginUsername.trim() || !loginPassword.trim()) {
      notifyError('กรุณากรอก User ID และรหัสผ่าน');
      return;
    }

    const res = StorageService.login(loginUsername.trim(), loginPassword.trim());
    if (res.success) {
      notifySuccess(res.message);
      onLoginSuccess();
      if (onClose) onClose();
    } else {
      notifyError(res.message);
    }
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    if (!regFullName.trim() || !regUsername.trim() || !regPassword.trim()) {
      notifyError('กรุณากรอกข้อมูลให้ครบถ้วน');
      return;
    }

    const res = StorageService.registerUser({
      fullName: regFullName.trim(),
      username: regUsername.trim(),
      password: regPassword.trim(),
      school: regSchool.trim() || 'โรงเรียนวิชาการวิทยาคาร',
    });

    if (res.success) {
      notifySuccess('ลงทะเบียนสำเร็จ!', res.message);
      setMode('LOGIN');
      setLoginUsername(regUsername.trim());
      setLoginPassword(regPassword.trim());
    } else {
      notifyError(res.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-slate-100 relative animate-in fade-in zoom-in duration-200">
        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        {/* Brand Header */}
        <div className="text-center space-y-2 mb-6">
          <div className="w-14 h-14 bg-linear-to-tr from-purple-600 to-indigo-600 text-white rounded-2xl flex items-center justify-center mx-auto shadow-md">
            <School className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            ระบบบริหารจัดการงานวิชาการ
          </h2>
          <p className="text-xs text-slate-500">
            {mode === 'LOGIN' ? 'เข้าสู่ระบบเพื่อจัดการและส่งงาน' : 'สมัครสมาชิกใหม่ (ต้องรอ Admin อนุมัติ)'}
          </p>
        </div>

        {/* Master Admin Bypass Banner */}
        <div className="mb-5 p-3 bg-purple-50/80 border border-purple-200/80 rounded-2xl space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-1.5 text-xs font-bold text-purple-900">
              <ShieldCheck className="w-4 h-4 text-purple-600" />
              <span>เข้าสู่ระบบด่วน (Quick Access):</span>
            </div>
            <span className="text-[11px] font-medium text-purple-700 bg-white px-2 py-0.5 rounded-md border border-purple-200">
              ผู้ดูแลระบบ & ครูผู้สอน
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              onClick={handleQuickMasterAdmin}
              className="btn-glow-purple py-1.5 px-2 bg-purple-600 hover:bg-purple-700 text-white text-[11px] font-bold rounded-xl transition-all cursor-pointer text-center"
            >
              🔑 คลิกเข้า Master Admin
            </button>

            <button
              type="button"
              onClick={handleQuickTeacher}
              className="py-1.5 px-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-[11px] font-bold rounded-xl transition-all cursor-pointer text-center"
            >
              👤 เข้าเป็นครู (สมชาย)
            </button>
          </div>
        </div>

        {/* Tab switch between Login and Register */}
        <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-2xl mb-5 text-xs font-bold">
          <button
            type="button"
            onClick={() => setMode('LOGIN')}
            className={`py-2 rounded-xl transition-all cursor-pointer ${
              mode === 'LOGIN' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            เข้าสู่ระบบ (Login)
          </button>
          <button
            type="button"
            onClick={() => setMode('REGISTER')}
            className={`py-2 rounded-xl transition-all cursor-pointer ${
              mode === 'REGISTER' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            สมัครสมาชิกใหม่
          </button>
        </div>

        {/* Form: LOGIN */}
        {mode === 'LOGIN' && (
          <form onSubmit={handleLogin} className="space-y-4 text-xs">
            <div className="space-y-1.5">
              <label className="font-bold text-slate-700">User ID / ชื่อผู้ใช้</label>
              <input
                type="text"
                required
                placeholder="เช่น Admin หรือ teacher_somchai"
                value={loginUsername}
                onChange={(e) => setLoginUsername(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-hidden focus:bg-white focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 text-sm font-medium"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-bold text-slate-700">รหัสผ่าน (Password)</label>
              <input
                type="password"
                required
                placeholder="••••••••"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-hidden focus:bg-white focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 text-sm font-medium"
              />
            </div>

            <button
              type="submit"
              className="w-full btn-glow-purple py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl text-sm transition-all cursor-pointer flex items-center justify-center space-x-2"
            >
              <LogIn className="w-4 h-4" />
              <span>เข้าสู่ระบบ</span>
            </button>
          </form>
        )}

        {/* Form: REGISTER */}
        {mode === 'REGISTER' && (
          <form onSubmit={handleRegister} className="space-y-3 text-xs">
            <div className="space-y-1">
              <label className="font-bold text-slate-700">ชื่อ-นามสกุล *</label>
              <input
                type="text"
                required
                placeholder="เช่น ครูสมหมาย สุขใจ"
                value={regFullName}
                onChange={(e) => setRegFullName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-hidden focus:bg-white"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-700">User ID สำหรับเข้าสู่ระบบ *</label>
              <input
                type="text"
                required
                placeholder="เช่น sommai_s"
                value={regUsername}
                onChange={(e) => setRegUsername(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-hidden focus:bg-white"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-700">รหัสผ่าน *</label>
              <input
                type="password"
                required
                placeholder="กำหนดรหัสผ่าน"
                value={regPassword}
                onChange={(e) => setRegPassword(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-hidden focus:bg-white"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-700">กลุ่มสาระฯ / แผนกวิชา</label>
              <input
                type="text"
                placeholder="เช่น กลุ่มสาระการเรียนรู้วิทยาศาสตร์"
                value={regSchool}
                onChange={(e) => setRegSchool(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-hidden focus:bg-white"
              />
            </div>

            <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-200 text-amber-800 text-[11px] flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>เมื่อสมัครแล้ว ต้องรอผู้ดูแลระบบ (Admin) กดอนุมัติก่อนจึงจะล็อกอินได้</span>
            </div>

            <button
              type="submit"
              className="w-full btn-glow-purple py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl text-sm transition-all cursor-pointer flex items-center justify-center space-x-2"
            >
              <UserPlus className="w-4 h-4" />
              <span>ลงทะเบียนสมัครสมาชิก</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

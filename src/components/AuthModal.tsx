import React, { useState, useEffect } from 'react';
import {
  LogIn,
  UserPlus,
  School,
  AlertCircle,
  X,
  Eye,
  EyeOff,
  CheckCircle2,
} from 'lucide-react';
import { StorageService } from '../services/storage';
import {
  notifySuccess,
  notifyError,
} from '../services/notifications';

interface AuthModalProps {
  isOpen: boolean;
  onClose?: () => void;
  onLoginSuccess: (user?: any) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
}) => {
  const [mode, setMode] = useState<'LOGIN' | 'REGISTER'>('LOGIN');

  // Login Form
  const [loginUsername, setLoginUsername] = useState(() => StorageService.getRememberedId());
  const [loginPassword, setLoginPassword] = useState('');
  const [rememberId, setRememberId] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Register Form
  const [regFullName, setRegFullName] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [regError, setRegError] = useState('');
  const [regSuccess, setRegSuccess] = useState('');

  // Auto-sync when modal opens or mode changes
  useEffect(() => {
    if (isOpen) {
      StorageService.syncWithCloudflare();
    }
  }, [isOpen, mode]);

  if (!isOpen) return null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');

    const u = loginUsername.trim();
    const p = loginPassword.trim();

    if (!u || !p) {
      setLoginError('กรุณากรอก User ID และรหัสผ่านให้ครบถ้วน');
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await StorageService.login(u, p);
      if (res.success && res.user) {
        if (rememberId) {
          StorageService.setRememberedId(u);
        } else {
          StorageService.setRememberedId(null);
        }
        notifySuccess(res.message);
        onLoginSuccess(res.user);
        if (onClose) onClose();
      } else {
        setLoginError(res.message || 'รหัสผ่านหรือ User ID ไม่ถูกต้อง');
        notifyError(res.message || 'รหัสผ่านหรือ User ID ไม่ถูกต้อง');
      }
    } catch (err: any) {
      console.error('Login error:', err);
      setLoginError('เกิดข้อผิดพลาดในการเข้าสู่ระบบ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError('');
    setRegSuccess('');

    const fn = regFullName.trim();
    const un = regUsername.trim();
    const pw = regPassword.trim();

    if (!fn || !un || !pw) {
      setRegError('กรุณากรอกข้อมูลให้ครบทุกช่องที่มีเครื่องหมาย *');
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await StorageService.registerUser({
        fullName: fn,
        username: un,
        password: pw,
        school: 'โรงเรียนวิชาการวิทยาคาร',
      });

      if (res.success) {
        notifySuccess('ลงทะเบียนสำเร็จ!', res.message);
        setMode('LOGIN');
        setLoginUsername(un);
        setLoginPassword(pw);
        setRegFullName('');
        setRegUsername('');
        setRegPassword('');
        setRegSuccess('');
      } else {
        setRegError(res.message);
        notifyError(res.message);
      }
    } catch (err: any) {
      console.error('Register error:', err);
      setRegError('เกิดข้อผิดพลาดในการลงทะเบียน กรุณาลองใหม่');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-slate-100 relative animate-in fade-in zoom-in duration-200">
        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
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

        {/* Tab switch between Login and Register */}
        <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-2xl mb-5 text-xs font-bold">
          <button
            type="button"
            onClick={() => {
              setMode('LOGIN');
              setLoginError('');
            }}
            className={`py-2 rounded-xl transition-all cursor-pointer ${
              mode === 'LOGIN' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            เข้าสู่ระบบ (Login)
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('REGISTER');
              setRegError('');
            }}
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
            {loginError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{loginError}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="font-bold text-slate-700">User ID / ชื่อผู้ใช้ *</label>
              <input
                type="text"
                required
                placeholder="ระบุ User ID ของคุณ"
                value={loginUsername}
                onChange={(e) => {
                  setLoginUsername(e.target.value);
                  if (loginError) setLoginError('');
                }}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-hidden focus:bg-white focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 text-sm font-medium"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-bold text-slate-700">รหัสผ่าน (Password) *</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="กรอกรหัสผ่าน"
                  value={loginPassword}
                  onChange={(e) => {
                    setLoginPassword(e.target.value);
                    if (loginError) setLoginError('');
                  }}
                  className="w-full pl-3.5 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-hidden focus:bg-white focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 text-sm font-medium"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between pt-0.5">
              <label className="flex items-center space-x-2 text-slate-600 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberId}
                  onChange={(e) => setRememberId(e.target.checked)}
                  className="w-4 h-4 text-purple-600 rounded-md border-slate-300 focus:ring-purple-500 cursor-pointer"
                />
                <span className="text-xs font-medium">จดจำ User ID นี้ไว้</span>
              </label>
              <span className="text-[11px] text-slate-400">ปลอดภัยเมื่อปิดแท็บ</span>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full btn-glow-purple py-3 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold rounded-xl text-sm transition-all cursor-pointer flex items-center justify-center space-x-2 shadow-md"
            >
              <LogIn className="w-4 h-4" />
              <span>{isSubmitting ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}</span>
            </button>
          </form>
        )}

        {/* Form: REGISTER */}
        {mode === 'REGISTER' && (
          <form onSubmit={handleRegister} className="space-y-3.5 text-xs">
            {regError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{regError}</span>
              </div>
            )}

            {regSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-xs flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{regSuccess}</span>
              </div>
            )}

            <div className="space-y-1">
              <label className="font-bold text-slate-700">ชื่อ-นามสกุล *</label>
              <input
                type="text"
                required
                placeholder="เช่น ครูสมหมาย สุขใจ"
                value={regFullName}
                onChange={(e) => setRegFullName(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-hidden focus:bg-white focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 text-sm font-medium"
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
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-hidden focus:bg-white focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 text-sm font-medium"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-700">รหัสผ่าน (Password) *</label>
              <div className="relative">
                <input
                  type={showRegPassword ? 'text' : 'password'}
                  required
                  placeholder="กำหนดรหัสผ่านของคุณ"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  className="w-full pl-3.5 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-hidden focus:bg-white focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 text-sm font-medium"
                />
                <button
                  type="button"
                  onClick={() => setShowRegPassword(!showRegPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  {showRegPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-800 text-[11px] flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>เมื่อสมัครแล้ว ต้องรอผู้ดูแลระบบ (Admin) กดอนุมัติก่อนจึงจะล็อกอินได้</span>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full btn-glow-purple py-3 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold rounded-xl text-sm transition-all cursor-pointer flex items-center justify-center space-x-2 shadow-md"
            >
              <UserPlus className="w-4 h-4" />
              <span>{isSubmitting ? 'กำลังบันทึกข้อมูล...' : 'ลงทะเบียนสมัครสมาชิก'}</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

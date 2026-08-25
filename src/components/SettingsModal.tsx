import React, { useState, useEffect } from 'react';
import {
  X,
  Settings,
  User as UserIcon,
  School,
  Users,
  CheckCircle2,
  Trash2,
  KeyRound,
  Clock,
  Camera,
  Save,
  Check,
  Loader2,
  Cloud,
  RefreshCw,
  ArrowUpRight,
  Database,
} from 'lucide-react';
import { User, SystemSettings } from '../types';
import { StorageService } from '../services/storage';
import { uploadFileToGoogleDrive } from '../services/driveUpload';
import { CloudflareApiService } from '../services/cloudflareApi';
import {
  notifySuccess,
  notifyError,
  confirmDialog,
} from '../services/notifications';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  settings: SystemSettings;
  users: User[];
  onRefreshData: () => void;
}

// Client-side image compressor using Canvas to ensure Base64 is under ~30KB
const compressImageFile = (
  file: File,
  maxWidth = 400,
  maxHeight = 400,
  quality = 0.85
): Promise<string> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(e.target?.result as string);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };
      img.onerror = () => {
        resolve(e.target?.result as string);
      };
      img.src = e.target?.result as string;
    };
    reader.onerror = () => {
      resolve('');
    };
    reader.readAsDataURL(file);
  });
};

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  settings,
  users,
  onRefreshData,
}) => {
  if (!isOpen || !currentUser) return null;

  const isAdmin = currentUser.role === 'ADMIN';

  // Tabs: 'PROFILE' | 'PASSWORD' | 'SCHOOL' | 'MEMBERS'
  const [activeTab, setActiveTab] = useState<'PROFILE' | 'PASSWORD' | 'SCHOOL' | 'MEMBERS'>('PROFILE');

  // Profile Form State
  const [fullName, setFullName] = useState(currentUser.fullName || '');
  const [school, setSchool] = useState(currentUser.school || '');
  const [avatarUrl, setAvatarUrl] = useState(currentUser.avatarUrl || '');

  // Password Form State
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // School & Footer Form State (Admin)
  const [schoolName, setSchoolName] = useState(settings.schoolName || '');
  const [schoolLogoUrl, setSchoolLogoUrl] = useState(settings.schoolLogoUrl || '');
  const [footerText, setFooterText] = useState(settings.footerText || '');

  // Loading / Feedback States
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileSavedSuccess, setProfileSavedSuccess] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [passwordSavedSuccess, setPasswordSavedSuccess] = useState(false);
  const [isSavingSchool, setIsSavingSchool] = useState(false);
  const [schoolSavedSuccess, setSchoolSavedSuccess] = useState(false);

  // Sync state whenever props change
  useEffect(() => {
    if (currentUser) {
      setFullName(currentUser.fullName || '');
      setSchool(currentUser.school || '');
      setAvatarUrl(currentUser.avatarUrl || '');
    }
    if (settings) {
      setSchoolName(settings.schoolName || '');
      setSchoolLogoUrl(settings.schoolLogoUrl || '');
      setFooterText(settings.footerText || '');
    }
    if (isOpen) {
      StorageService.syncWithCloudflare().then(() => {
        onRefreshData();
      });
    }
  }, [currentUser, settings, isOpen, activeTab, onRefreshData]);

  // Handle Avatar Upload directly to Google Drive
  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const compressed = await compressImageFile(file, 300, 300, 0.85);
        setAvatarUrl(compressed); // Instant responsive local preview

        // Upload to Google Drive in parallel
        const driveResult = await uploadFileToGoogleDrive(file);
        if (driveResult.fileUrl) {
          setAvatarUrl(driveResult.fileUrl);
        }
        notifySuccess('อัปโหลดรูปภาพโปรไฟล์เรียบร้อยแล้ว ✨');
      } catch (err) {
        console.error('Avatar upload error:', err);
      }
    }
  };

  // Handle Logo Upload directly to Google Drive
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const compressed = await compressImageFile(file, 400, 400, 0.85);
        setSchoolLogoUrl(compressed); // Instant responsive preview

        // Upload to Google Drive in parallel
        const driveResult = await uploadFileToGoogleDrive(file);
        if (driveResult.fileUrl) {
          setSchoolLogoUrl(driveResult.fileUrl);
        }
        notifySuccess('อัปโหลดโลโก้สถานศึกษาเรียบร้อยแล้ว ✨');
      } catch (err) {
        console.error('Logo upload error:', err);
      }
    }
  };

  // 1. Save Profile
  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingProfile(true);

    try {
      const updatedUser: User = {
        ...currentUser,
        fullName: fullName.trim() || currentUser.fullName || 'ผู้ใช้งาน',
        school: school.trim() || currentUser.school || 'โรงเรียนวิชาการวิทยาคาร',
        avatarUrl: avatarUrl || currentUser.avatarUrl,
      };

      StorageService.updateUser(updatedUser);
      setProfileSavedSuccess(true);
      notifySuccess('บันทึกข้อมูลส่วนตัวเรียบร้อยแล้ว ✨');
      onRefreshData();

      setTimeout(() => {
        setProfileSavedSuccess(false);
      }, 2500);
    } catch (err) {
      console.error('Save profile error:', err);
      notifyError('เกิดข้อผิดพลาดในการบันทึกข้อมูล');
    } finally {
      setIsSavingProfile(false);
    }
  };

  // 2. Save Password
  const handleSavePassword = (e: React.FormEvent) => {
    e.preventDefault();
    const p1 = newPassword.trim();
    const p2 = confirmPassword.trim();

    if (!p1) {
      notifyError('กรุณากรอกรหัสผ่านใหม่');
      return;
    }
    if (p1 !== p2) {
      notifyError('รหัสผ่านใหม่และการยืนยันรหัสผ่านไม่ตรงกัน');
      return;
    }

    setIsSavingPassword(true);

    try {
      const updatedUser: User = {
        ...currentUser,
        password: p1,
      };

      StorageService.updateUser(updatedUser);
      setPasswordSavedSuccess(true);
      notifySuccess('เปลี่ยนรหัสผ่านใหม่เรียบร้อยแล้ว 🔒');
      setNewPassword('');
      setConfirmPassword('');
      onRefreshData();

      setTimeout(() => {
        setPasswordSavedSuccess(false);
      }, 2500);
    } catch (err) {
      console.error('Save password error:', err);
      notifyError('เกิดข้อผิดพลาดในการเปลี่ยนรหัสผ่าน');
    } finally {
      setIsSavingPassword(false);
    }
  };

  // 3. Save School & Footer Settings
  const handleSaveSchoolSettings = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSchool(true);

    try {
      const updatedSettings: SystemSettings = {
        ...settings,
        schoolName: schoolName.trim() || settings.schoolName || 'โรงเรียนวิชาการวิทยาคาร',
        schoolLogoUrl: schoolLogoUrl || settings.schoolLogoUrl,
        footerText: footerText.trim() || settings.footerText,
      };

      StorageService.saveSettings(updatedSettings);
      setSchoolSavedSuccess(true);
      notifySuccess('บันทึกข้อมูลสถานศึกษาและข้อความ Footer เรียบร้อยแล้ว ✨');
      onRefreshData();

      setTimeout(() => {
        setSchoolSavedSuccess(false);
      }, 2500);
    } catch (err) {
      console.error('Save school settings error:', err);
      notifyError('เกิดข้อผิดพลาดในการบันทึกข้อมูลสถานศึกษา');
    } finally {
      setIsSavingSchool(false);
    }
  };

  // 4. Admin Member Approvals & Deletion
  const handleApprove = async (userId: string) => {
    await StorageService.approveUser(userId);
    notifySuccess('อนุมัติการเข้าใช้งานของสมาชิกเรียบร้อยแล้ว');
    onRefreshData();
  };

  const handleDeleteUser = async (userId: string) => {
    const ok = await confirmDialog(
      'ยืนยันการลบผู้ใช้นี้?',
      'บัญชีผู้ใช้และสิทธิ์การเข้าใช้งานจะถูกลบออกจากระบบ'
    );
    if (ok) {
      await StorageService.deleteUser(userId);
      notifySuccess('ลบผู้ใช้งานสำเร็จ');
      onRefreshData();
    }
  };

  const pendingUsers = users.filter((u) => u.status === 'PENDING');
  const activeUsers = users.filter((u) => u.status === 'ACTIVE');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-3xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl border border-slate-100 relative max-h-[90vh] flex flex-col animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center space-x-2.5">
            <div className="w-10 h-10 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center shadow-xs border border-purple-100">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800">
                System Settings & Management
              </h2>
              <p className="text-xs text-slate-400">จัดการข้อมูลส่วนตัว รหัสผ่าน และการตั้งค่าระบบ</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center space-x-2 py-3 border-b border-slate-100 overflow-x-auto text-xs font-bold scrollbar-none">
          <button
            type="button"
            onClick={() => setActiveTab('PROFILE')}
            className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center space-x-1.5 shrink-0 ${
              activeTab === 'PROFILE'
                ? 'bg-purple-50 text-purple-700 border border-purple-200 shadow-2xs'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <UserIcon className="w-4 h-4" />
            <span>1. ข้อมูลส่วนตัว</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('PASSWORD')}
            className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center space-x-1.5 shrink-0 ${
              activeTab === 'PASSWORD'
                ? 'bg-purple-50 text-purple-700 border border-purple-200 shadow-2xs'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <KeyRound className="w-4 h-4" />
            <span>2. เปลี่ยนรหัสผ่าน</span>
          </button>

          {isAdmin && (
            <>
              <button
                type="button"
                onClick={() => setActiveTab('SCHOOL')}
                className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center space-x-1.5 shrink-0 ${
                  activeTab === 'SCHOOL'
                    ? 'bg-purple-50 text-purple-700 border border-purple-200 shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <School className="w-4 h-4" />
                <span>3. ข้อมูลโรงเรียน & Footer</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('MEMBERS')}
                className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center space-x-1.5 shrink-0 ${
                  activeTab === 'MEMBERS'
                    ? 'bg-purple-50 text-purple-700 border border-purple-200 shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Users className="w-4 h-4" />
                <span>4. จัดการสมาชิก</span>
                {pendingUsers.length > 0 && (
                  <span className="ml-1 bg-amber-500 text-white px-1.5 py-0.2 rounded-full text-[10px]">
                    {pendingUsers.length}
                  </span>
                )}
              </button>
            </>
          )}
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto py-4 space-y-4">
          {/* TAB 1: Profile Settings */}
          {activeTab === 'PROFILE' && (
            <form onSubmit={handleSaveProfile} className="space-y-4 text-xs">
              <div className="flex items-center space-x-4 p-4 bg-slate-50/80 rounded-2xl border border-slate-200/80">
                <div className="relative group shrink-0">
                  <img
                    src={avatarUrl || 'https://api.dicebear.com/7.x/bottts/svg?seed=user'}
                    alt="Avatar"
                    className="w-16 h-16 rounded-full object-cover ring-2 ring-purple-500/30 shadow-xs"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src =
                        'https://api.dicebear.com/7.x/bottts/svg?seed=user';
                    }}
                  />
                  <div className="absolute inset-0 bg-slate-900/30 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Camera className="w-5 h-5 text-white" />
                  </div>
                </div>

                <div className="space-y-1.5 flex-1">
                  <label className="font-bold text-slate-700 block">อัปโหลดรูปภาพโปรไฟล์</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarUpload}
                    className="text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-purple-100 file:text-purple-700 hover:file:bg-purple-200 cursor-pointer"
                  />
                  <p className="text-[11px] text-slate-400">ระบบบีบอัดและปรับขนาดรูปภาพให้อัตโนมัติ (PNG, JPG, JPEG)</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">ชื่อ-นามสกุล</label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="เช่น ครูสมหมาย สุขใจ"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-hidden focus:bg-white text-xs font-medium"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700">กลุ่มสาระฯ / แผนก / สังกัด</label>
                  <input
                    type="text"
                    value={school}
                    onChange={(e) => setSchool(e.target.value)}
                    placeholder="เช่น กลุ่มสาระการเรียนรู้วิทยาศาสตร์"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-hidden focus:bg-white text-xs font-medium"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={isSavingProfile}
                  className={`px-5 py-2.5 font-bold text-white rounded-xl transition-all cursor-pointer flex items-center space-x-2 text-xs shadow-md ${
                    profileSavedSuccess
                      ? 'bg-emerald-600 hover:bg-emerald-700'
                      : 'btn-glow-purple bg-purple-600 hover:bg-purple-700'
                  }`}
                >
                  {isSavingProfile ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>กำลังบันทึก...</span>
                    </>
                  ) : profileSavedSuccess ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span>บันทึกเรียบร้อยแล้ว! ✨</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>บันทึกข้อมูลส่วนตัว</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* TAB 2: Change Password */}
          {activeTab === 'PASSWORD' && (
            <form onSubmit={handleSavePassword} className="space-y-4 text-xs">
              <div className="p-4 bg-purple-50/60 rounded-2xl border border-purple-100 flex items-start space-x-3">
                <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
                  <KeyRound className="w-4 h-4" />
                </div>
                <div>
                  <p className="font-bold text-purple-950 text-xs">เปลี่ยนรหัสผ่านเพื่อความปลอดภัย</p>
                  <p className="text-[11px] text-purple-700/80">
                    กำหนดรหัสผ่านใหม่ที่คุณต้องการใช้ในการเข้าสู่ระบบครั้งถัดไป
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">รหัสผ่านใหม่ (New Password) *</label>
                  <input
                    type="password"
                    placeholder="กำหนดรหัสผ่านใหม่"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-hidden focus:bg-white focus:ring-2 focus:ring-purple-500/20 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700">ยืนยันรหัสผ่านใหม่อีกครั้ง (Confirm Password) *</label>
                  <input
                    type="password"
                    placeholder="พิมพ์รหัสผ่านใหม่อีกครั้ง"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-hidden focus:bg-white focus:ring-2 focus:ring-purple-500/20 text-xs"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={isSavingPassword}
                  className={`px-5 py-2.5 font-bold text-white rounded-xl transition-all cursor-pointer flex items-center space-x-2 text-xs shadow-md ${
                    passwordSavedSuccess
                      ? 'bg-emerald-600 hover:bg-emerald-700'
                      : 'btn-glow-purple bg-purple-600 hover:bg-purple-700'
                  }`}
                >
                  {isSavingPassword ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>กำลังบันทึก...</span>
                    </>
                  ) : passwordSavedSuccess ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span>เปลี่ยนรหัสผ่านสำเร็จ! 🔒</span>
                    </>
                  ) : (
                    <>
                      <KeyRound className="w-4 h-4" />
                      <span>บันทึกรหัสผ่านใหม่</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* TAB 3: School & Footer (Admin only) */}
          {activeTab === 'SCHOOL' && isAdmin && (
            <form onSubmit={handleSaveSchoolSettings} className="space-y-4 text-xs">
              <div className="flex items-center space-x-4 p-4 bg-slate-50/80 rounded-2xl border border-slate-200/80">
                {schoolLogoUrl ? (
                  <img
                    src={schoolLogoUrl}
                    alt="School Logo"
                    className="w-16 h-16 rounded-2xl object-cover ring-2 ring-purple-500/30 shadow-xs shrink-0"
                    onError={(e) => {
                      (e.currentTarget as HTMLElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="w-16 h-16 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-xl shrink-0">
                    <School className="w-8 h-8" />
                  </div>
                )}
                <div className="space-y-1.5 flex-1">
                  <label className="font-bold text-slate-700 block">อัปโหลดไฟล์ภาพโลโก้โรงเรียน</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    className="text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-purple-100 file:text-purple-700 hover:file:bg-purple-200 cursor-pointer"
                  />
                  <p className="text-[11px] text-slate-400">ระบบบีบอัดและปรับขนาดรูปภาพให้อัตโนมัติ แสดงผลที่แถบเมนูด้านบน</p>
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">ชื่อโรงเรียน / สถานศึกษา / หน่วยงาน</label>
                <input
                  type="text"
                  value={schoolName}
                  onChange={(e) => setSchoolName(e.target.value)}
                  placeholder="เช่น โรงเรียนวิชาการวิทยาคาร"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-hidden focus:bg-white text-xs font-medium"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">ข้อความส่วนท้าย (Footer Text)</label>
                <textarea
                  rows={2}
                  value={footerText}
                  onChange={(e) => setFooterText(e.target.value)}
                  placeholder="เช่น ระบบบริหารจัดการงานวิชาการ มอบหมายงานและส่งงาน © 2026 สงวนลิขสิทธิ์ทุกประการ"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-hidden focus:bg-white text-xs font-medium"
                />
              </div>

              {/* Seamless Backend Storage Note */}
              <div className="p-3 bg-emerald-50/80 rounded-2xl border border-emerald-200/80 flex items-center space-x-2.5 text-emerald-800">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
                <span className="text-[11px] font-medium">
                  ระบบจัดเก็บไฟล์ Google Drive และฐานข้อมูลหลังบ้านเชื่อมต่อพร้อมใช้งานสมบูรณ์
                </span>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={isSavingSchool}
                  className={`px-5 py-2.5 font-bold text-white rounded-xl transition-all cursor-pointer flex items-center space-x-2 text-xs shadow-md ${
                    schoolSavedSuccess
                      ? 'bg-emerald-600 hover:bg-emerald-700'
                      : 'btn-glow-purple bg-purple-600 hover:bg-purple-700'
                  }`}
                >
                  {isSavingSchool ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>กำลังบันทึก...</span>
                    </>
                  ) : schoolSavedSuccess ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span>บันทึกสถานศึกษาสำเร็จ! ✨</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>บันทึกข้อมูลสถานศึกษา</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* TAB 4: Member Approval Management (Admin only) */}
          {activeTab === 'MEMBERS' && isAdmin && (
            <div className="space-y-5 text-xs">
              {/* Pending Approvals */}
              <div>
                <div className="flex items-center space-x-2 mb-2">
                  <Clock className="w-4 h-4 text-amber-600" />
                  <h2 className="font-bold text-slate-800">
                    รายการสมัครสมาชิกรอการอนุมัติ ({pendingUsers.length} ท่าน)
                  </h2>
                </div>

                {pendingUsers.length === 0 ? (
                  <p className="text-slate-400 italic p-4 bg-slate-50/80 rounded-2xl border border-dashed text-center">
                    ไม่มีผู้ใช้รอการอนุมัติ
                  </p>
                ) : (
                  <div className="space-y-2">
                    {pendingUsers.map((u) => (
                      <div
                        key={u.id}
                        className="p-3 bg-amber-50/70 border border-amber-200 rounded-2xl flex items-center justify-between gap-2"
                      >
                        <div className="flex items-center space-x-2.5">
                          <img
                            src={u.avatarUrl}
                            alt=""
                            className="w-8 h-8 rounded-full object-cover ring-1 ring-amber-300"
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).src =
                                'https://api.dicebear.com/7.x/bottts/svg?seed=user';
                            }}
                          />
                          <div>
                            <p className="font-bold text-slate-900">{u.fullName}</p>
                            <p className="text-[11px] text-slate-600">
                              User ID: <span className="font-mono">{u.username}</span> • {u.school}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center space-x-1.5">
                          <button
                            type="button"
                            onClick={() => handleApprove(u.id)}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold flex items-center space-x-1 shadow-xs cursor-pointer"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>อนุมัติ</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteUser(u.id)}
                            className="p-1.5 text-rose-600 hover:bg-rose-100 rounded-xl cursor-pointer"
                            title="ปฏิเสธ / ลบ"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Active Members List */}
              <div>
                <h2 className="font-bold text-slate-800 mb-2">
                  สมาชิกที่เปิดใช้งานในระบบทั้งหมด ({activeUsers.length} ท่าน)
                </h2>
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden">
                  {activeUsers.map((u) => (
                    <div
                      key={u.id}
                      className="p-3 bg-white hover:bg-slate-50 flex items-center justify-between gap-2"
                    >
                      <div className="flex items-center space-x-2.5">
                        <img
                          src={u.avatarUrl}
                          alt=""
                          className="w-8 h-8 rounded-full object-cover ring-1 ring-slate-200"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).src =
                              'https://api.dicebear.com/7.x/bottts/svg?seed=user';
                          }}
                        />
                        <div>
                          <div className="flex items-center space-x-1.5">
                            <span className="font-bold text-slate-800">{u.fullName}</span>
                            {u.role === 'ADMIN' && (
                              <span className="text-[10px] bg-purple-100 text-purple-700 font-bold px-1.5 py-0.2 rounded">
                                Admin
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500">
                            ID: <span className="font-mono">{u.username}</span> • {u.school}
                          </p>
                        </div>
                      </div>

                      {u.username.toLowerCase() !== 'admin' && (
                        <button
                          type="button"
                          onClick={() => handleDeleteUser(u.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl cursor-pointer"
                          title="ลบสมาชิก"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

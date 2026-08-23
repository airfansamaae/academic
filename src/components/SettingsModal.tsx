import React, { useState } from 'react';
import {
  X,
  Settings,
  User as UserIcon,
  School,
  Users,
  CheckCircle2,
  Trash2,
  HardDrive,
  Database,
  Upload,
  Shield,
  Clock,
  Sparkles,
} from 'lucide-react';
import { User, SystemSettings } from '../types';
import { StorageService } from '../services/storage';
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

  // Tabs: 'PROFILE' | 'SCHOOL' | 'MEMBERS'
  const [activeTab, setActiveTab] = useState<'PROFILE' | 'SCHOOL' | 'MEMBERS'>('PROFILE');

  // Profile Form
  const [fullName, setFullName] = useState(currentUser.fullName);
  const [school, setSchool] = useState(currentUser.school);
  const [avatarUrl, setAvatarUrl] = useState(currentUser.avatarUrl);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // School & Footer Form (Admin)
  const [schoolName, setSchoolName] = useState(settings.schoolName);
  const [schoolLogoUrl, setSchoolLogoUrl] = useState(settings.schoolLogoUrl);
  const [footerText, setFooterText] = useState(settings.footerText);
  const [gDriveFolderId, setGDriveFolderId] = useState(settings.gDriveFolderId || '1oOywsmTzdy1CMJDQuzNk9yJhH0lwWVZu');
  const [gasWebhookUrl, setGasWebhookUrl] = useState(
    settings.gasWebhookUrl ||
      'https://script.google.com/macros/s/AKfycbzve6nmcAMloypZThIb5aRyKfLd3NJCeoddYU8NToVMCXKltjG9WWEI6yA-tetESAt26w/exec'
  );

  // Handle Logo Upload simulation
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setSchoolLogoUrl(reader.result as string);
        notifySuccess('อัปโหลดไฟล์โลโก้โรงเรียนสำเร็จ');
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle Avatar Upload simulation
  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setAvatarUrl(reader.result as string);
        notifySuccess('อัปโหลดรูปโปรไฟล์สำเร็จ');
      };
      reader.readAsDataURL(file);
    }
  };

  // Save Profile
  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword && newPassword !== confirmPassword) {
      notifyError('รหัสผ่านใหม่และการยืนยันรหัสผ่านไม่ตรงกัน');
      return;
    }

    const updatedUser = {
      ...currentUser,
      fullName: fullName.trim(),
      school: school.trim(),
      avatarUrl: avatarUrl.trim(),
      ...(newPassword ? { password: newPassword.trim() } : {}),
    };

    StorageService.updateUser(updatedUser);
    notifySuccess('บันทึกข้อมูลโปรไฟล์และรหัสผ่านเรียบร้อยแล้ว');
    setNewPassword('');
    setConfirmPassword('');
    onRefreshData();
  };

  // Save School & Footer Settings
  const handleSaveSchoolSettings = (e: React.FormEvent) => {
    e.preventDefault();
    StorageService.saveSettings({
      ...settings,
      schoolName: schoolName.trim(),
      schoolLogoUrl: schoolLogoUrl.trim(),
      footerText: footerText.trim(),
      gDriveFolderId: gDriveFolderId.trim() || '1oOywsmTzdy1CMJDQuzNk9yJhH0lwWVZu',
      gasWebhookUrl: gasWebhookUrl.trim(),
    });
    notifySuccess('บันทึกข้อมูลสถานศึกษาและการเชื่อมต่อ Google Drive สำเร็จ');
    onRefreshData();
  };

  // Admin: Approve Member
  const handleApprove = (userId: string) => {
    StorageService.approveUser(userId);
    notifySuccess('อนุมัติการเข้าใช้งานของสมาชิกเรียบร้อยแล้ว');
    onRefreshData();
  };

  // Admin: Delete User
  const handleDeleteUser = async (userId: string) => {
    const ok = await confirmDialog(
      'ยืนยันการลบผู้ใช้นี้?',
      'บัญชีผู้ใช้และสิทธิ์การเข้าใช้งานจะถูกลบ'
    );
    if (ok) {
      StorageService.deleteUser(userId);
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
              <p className="text-xs text-slate-400">จัดการข้อมูลส่วนตัว สถานศึกษา และสิทธิ์สมาชิก</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center space-x-2 py-3 border-b border-slate-100 overflow-x-auto text-xs font-bold">
          <button
            onClick={() => setActiveTab('PROFILE')}
            className={`px-3.5 py-1.5 rounded-xl transition-all cursor-pointer flex items-center space-x-1.5 shrink-0 ${
              activeTab === 'PROFILE'
                ? 'bg-purple-50 text-purple-700 border border-purple-200 shadow-2xs'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <UserIcon className="w-4 h-4" />
            <span>1. ข้อมูลส่วนตัว & โปรไฟล์</span>
          </button>

          {isAdmin && (
            <>
              <button
                onClick={() => setActiveTab('SCHOOL')}
                className={`px-3.5 py-1.5 rounded-xl transition-all cursor-pointer flex items-center space-x-1.5 shrink-0 ${
                  activeTab === 'SCHOOL'
                    ? 'bg-purple-50 text-purple-700 border border-purple-200 shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <School className="w-4 h-4" />
                <span>2. โลโก้ & ข้อมูลโรงเรียน & Footer</span>
              </button>

              <button
                onClick={() => setActiveTab('MEMBERS')}
                className={`px-3.5 py-1.5 rounded-xl transition-all cursor-pointer flex items-center space-x-1.5 shrink-0 ${
                  activeTab === 'MEMBERS'
                    ? 'bg-purple-50 text-purple-700 border border-purple-200 shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Users className="w-4 h-4" />
                <span>3. จัดการสมาชิก</span>
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
              <div className="flex items-center space-x-4 p-3.5 bg-slate-50/80 rounded-2xl border border-slate-200/80">
                <img
                  src={avatarUrl}
                  alt="Avatar"
                  className="w-14 h-14 rounded-full object-cover ring-2 ring-purple-500/30"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src =
                      'https://api.dicebear.com/7.x/bottts/svg?seed=user';
                  }}
                />
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 block">อัปโหลดรูปโปรไฟล์ผู้ใช้</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarUpload}
                    className="text-xs text-slate-500 file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-purple-100 file:text-purple-700 hover:file:bg-purple-200 cursor-pointer"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">ชื่อ-นามสกุล *</label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-hidden focus:bg-white text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700">กลุ่มสาระฯ / สังกัด</label>
                  <input
                    type="text"
                    value={school}
                    onChange={(e) => setSchool(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-hidden focus:bg-white text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Avatar Image URL (หรือใช้ลิงก์ภาพ)</label>
                <input
                  type="text"
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-hidden text-xs"
                />
              </div>

              {/* Change Password Section */}
              <div className="p-3 bg-purple-50/50 rounded-2xl border border-purple-100 space-y-2.5">
                <div className="flex items-center space-x-1.5 font-bold text-purple-900">
                  <Shield className="w-4 h-4 text-purple-600" />
                  <span>เปลี่ยนรหัสผ่าน (หากต้องการเปลี่ยน)</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="password"
                    placeholder="รหัสผ่านใหม่"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-purple-200 rounded-xl outline-hidden text-xs"
                  />
                  <input
                    type="password"
                    placeholder="ยืนยันรหัสผ่านใหม่"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-purple-200 rounded-xl outline-hidden text-xs"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  className="btn-glow-purple px-5 py-2 font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-xl"
                >
                  บันทึกข้อมูลโปรไฟล์
                </button>
              </div>
            </form>
          )}

          {/* TAB 2: School & Footer (Admin only) */}
          {activeTab === 'SCHOOL' && isAdmin && (
            <form onSubmit={handleSaveSchoolSettings} className="space-y-4 text-xs">
              <div className="flex items-center space-x-4 p-3.5 bg-slate-50/80 rounded-2xl border border-slate-200/80">
                <img
                  src={schoolLogoUrl}
                  alt="School Logo"
                  className="w-14 h-14 rounded-xl object-cover ring-2 ring-purple-500/30"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 block">อัปโหลดไฟล์โลโก้โรงเรียน</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    className="text-xs text-slate-500 file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-purple-100 file:text-purple-700 hover:file:bg-purple-200 cursor-pointer"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">ชื่อโรงเรียน / หน่วยงาน *</label>
                <input
                  type="text"
                  required
                  value={schoolName}
                  onChange={(e) => setSchoolName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-hidden focus:bg-white text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">ข้อความ Footer ด้านล่างของเว็บไซต์ *</label>
                <textarea
                  rows={2}
                  required
                  value={footerText}
                  onChange={(e) => setFooterText(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-hidden focus:bg-white text-xs"
                />
              </div>

              {/* Google Drive Integration Configuration */}
              <div className="p-3.5 bg-slate-50/80 rounded-2xl border border-slate-200/80 space-y-3">
                <div className="flex items-center space-x-2 font-bold text-slate-700">
                  <HardDrive className="w-4 h-4 text-purple-600" />
                  <span>การเชื่อมต่อ Google Drive อัตโนมัติ (Apps Script Webhook):</span>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-600">Google Drive Folder ID</label>
                  <input
                    type="text"
                    value={gDriveFolderId}
                    onChange={(e) => setGDriveFolderId(e.target.value)}
                    placeholder="1oOywsmTzdy1CMJDQuzNk9yJhH0lwWVZu"
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl outline-hidden text-xs font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-600">Google Apps Script Webhook URL</label>
                  <input
                    type="text"
                    value={gasWebhookUrl}
                    onChange={(e) => setGasWebhookUrl(e.target.value)}
                    placeholder="https://script.google.com/macros/s/.../exec"
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl outline-hidden text-xs font-mono text-slate-700"
                  />
                </div>

                <div className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-200 text-[11px] text-emerald-800 font-medium space-y-1">
                  <p className="flex items-center space-x-1.5 font-bold">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span>เชื่อมต่อ Google Drive สำเร็จ: ไฟล์งานที่อัปโหลดจะถูกส่งไปยังไดรฟ์โดยตรง</span>
                  </p>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  className="btn-glow-purple px-5 py-2 font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-xl"
                >
                  บันทึกข้อมูลสถานศึกษา
                </button>
              </div>
            </form>
          )}

          {/* TAB 3: Member Approval Management (Admin only) */}
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
                  <p className="text-slate-400 italic p-3 bg-slate-50/80 rounded-2xl border border-dashed text-center">
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
                            className="w-8 h-8 rounded-full object-cover"
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
                            onClick={() => handleApprove(u.id)}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold flex items-center space-x-1 shadow-xs cursor-pointer"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>อนุมัติ</span>
                          </button>
                          <button
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
                          className="w-7 h-7 rounded-full object-cover"
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

                      {u.username !== 'Admin' && (
                        <button
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

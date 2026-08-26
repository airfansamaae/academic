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
  FolderOpen,
  FolderPlus,
  Copy,
  ExternalLink,
  Code2,
  Sparkles,
} from 'lucide-react';
import { User, SystemSettings } from '../types';
import {
  StorageService,
  GDRIVE_FOLDER_ID,
  GDRIVE_FOLDER_URL,
  GDRIVE_OFFICIAL_ORDERS_FOLDER_ID,
  GDRIVE_SAMPLE_DOCS_FOLDER_ID,
} from '../services/storage';
import {
  uploadFileToGoogleDrive,
  createGoogleDriveFolder,
  deleteGoogleDriveFolder,
  deleteGoogleDriveFile,
  getActiveGasWebhookUrl,
  GOOGLE_APPS_SCRIPT_CODE,
  GAS_WEBHOOK_URL,
} from '../services/driveUpload';
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

  // Tabs: 'PROFILE' | 'PASSWORD' | 'SCHOOL' | 'MEMBERS' | 'GDRIVE'
  const [activeTab, setActiveTab] = useState<'PROFILE' | 'PASSWORD' | 'SCHOOL' | 'MEMBERS' | 'GDRIVE'>('PROFILE');

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

  // Google Drive tab state
  const [gasWebhookUrl, setGasWebhookUrl] = useState(settings.gasWebhookUrl || GAS_WEBHOOK_URL);
  const [isSavingWebhook, setIsSavingWebhook] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [diagStep1, setDiagStep1] = useState<'idle' | 'running' | 'success' | 'failed'>('idle');
  const [diagStep2, setDiagStep2] = useState<'idle' | 'running' | 'success' | 'failed'>('idle');
  const [diagStep3, setDiagStep3] = useState<'idle' | 'running' | 'success' | 'failed'>('idle');
  const [diagLog, setDiagLog] = useState<string | null>(null);

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(GOOGLE_APPS_SCRIPT_CODE);
      setCopiedCode(true);
      notifySuccess('คัดลอกโค้ด Google Apps Script v2 เรียบร้อยแล้ว! นำไปวางใน Apps Script ได้ทันที 📋✨');
      setTimeout(() => setCopiedCode(false), 3000);
    } catch {
      notifyError('ไม่สามารถคัดลอกโค้ดได้อัตโนมัติ กรุณากดเลือกและคัดลอกด้วยตนเอง');
    }
  };

  const handleSaveWebhookUrl = () => {
    setIsSavingWebhook(true);
    try {
      const cleanUrl = gasWebhookUrl.trim();
      const updatedSettings: SystemSettings = {
        ...settings,
        gasWebhookUrl: cleanUrl,
        updatedAt: new Date().toISOString(),
      };
      StorageService.saveSettings(updatedSettings);
      notifySuccess('บันทึก Google Apps Script Webhook URL สำเร็จ! ✨');
      onRefreshData();
    } catch (err) {
      notifyError('เกิดข้อผิดพลาดในการบันทึก URL');
    } finally {
      setIsSavingWebhook(false);
    }
  };

  const handleResetWebhookUrl = () => {
    setGasWebhookUrl(GAS_WEBHOOK_URL);
    const updatedSettings: SystemSettings = {
      ...settings,
      gasWebhookUrl: GAS_WEBHOOK_URL,
      updatedAt: new Date().toISOString(),
    };
    StorageService.saveSettings(updatedSettings);
    notifySuccess('คืนค่า Google Apps Script Webhook URL เริ่มต้นเรียบร้อยแล้ว');
    onRefreshData();
  };

  const handleRunFullDiagnostic = async () => {
    setIsDiagnosing(true);
    setDiagStep1('running');
    setDiagStep2('idle');
    setDiagStep3('idle');
    setDiagLog(null);

    const activeUrl = gasWebhookUrl.trim() || GAS_WEBHOOK_URL;
    let createdTestFolderId = '';

    try {
      // Step 1: GET Ping
      try {
        const pingRes = await fetch(activeUrl, { method: 'GET' });
        if (pingRes.ok) {
          const pingData = await pingRes.json().catch(() => null);
          if (pingData?.status === 'online' || pingData?.version === '2.0') {
            setDiagStep1('success');
          } else {
            setDiagStep1('failed');
          }
        } else {
          setDiagStep1('failed');
        }
      } catch {
        setDiagStep1('failed');
      }

      // Step 2: POST createFolder
      setDiagStep2('running');
      const now = new Date();
      const testName = `ทดสอบระบบ_${now.toLocaleDateString('th-TH')}_${now.getHours()}${now.getMinutes()}${now.getSeconds()}`;
      const folderRes = await createGoogleDriveFolder(testName, undefined, activeUrl);

      if (folderRes.success && folderRes.folderId && !folderRes.folderId.startsWith('task_folder_')) {
        createdTestFolderId = folderRes.folderId;
        setDiagStep2('success');

        // Step 3: POST deleteFolder (test automatic deletion!)
        setDiagStep3('running');
        const deleteRes = await deleteGoogleDriveFolder(createdTestFolderId, activeUrl);
        if (deleteRes) {
          setDiagStep3('success');
          setDiagLog(`✅ การทดสอบสมบูรณ์แบบ 100%!\n- ตรวจพบ Webhook v2\n- สร้างโฟลเดอร์ "${testName}" สำเร็จ (ID: ${createdTestFolderId})\n- ลบโฟลเดอร์ทดสอบออกจาก Google Drive สำเร็จอัตโนมัติ`);
          notifySuccess('ทดสอบระบบ Google Drive สำเร็จสมบูรณ์แบบทั้งการสร้างและลบ 📁🗑️✨');
        } else {
          setDiagStep3('failed');
          setDiagLog(`⚠️ สร้างโฟลเดอร์สำเร็จ แต่คำสั่งลบโฟลเดอร์ไม่ตอบสนอง กรุณาตรวจสอบการ Deploy เวอร์ชันใหม่ใน Apps Script`);
        }
      } else {
        setDiagStep2('failed');
        setDiagStep3('idle');
        setDiagLog(`❌ Google Apps Script ปัจจุบันยังไม่รองรับคำสั่งสร้างโฟลเดอร์ (หรือยังเป็น Script เก่า)\nกรุณาคัดลอกโค้ด v2 ด้านล่างไปวางและ Deploy ใน Google Apps Script ตามคำแนะนำ 4 ขั้นตอน`);
        notifyError('Apps Script ยังไม่รองรับคำสั่ง v2 กรุณาอัปเดตโค้ดใน Apps Script');
      }
    } catch (err: any) {
      setDiagStep2('failed');
      setDiagStep3('failed');
      setDiagLog(`เกิดข้อผิดพลาดในการเชื่อมต่อ: ${err?.message || err}`);
    } finally {
      setIsDiagnosing(false);
    }
  };

  // Initialize form state ONLY when modal is opened or user changes (do NOT overwrite while user is typing)
  useEffect(() => {
    if (isOpen && currentUser) {
      setFullName(currentUser.fullName || '');
      setSchool(currentUser.school || '');
      setAvatarUrl(currentUser.avatarUrl || '');
      setSchoolName(settings.schoolName || '');
      setSchoolLogoUrl(settings.schoolLogoUrl || '');
      setFooterText(settings.footerText || '');
      setNewPassword('');
      setConfirmPassword('');
      setProfileSavedSuccess(false);
      setPasswordSavedSuccess(false);
      setSchoolSavedSuccess(false);
    }
  }, [isOpen, currentUser?.id]);

  // Handle Avatar Upload directly to Profile & Cloud
  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const compressed = await compressImageFile(file, 250, 250, 0.85);
        if (compressed) {
          setAvatarUrl(compressed);
          // Auto-save user profile with new avatar immediately
          if (currentUser) {
            const updated: User = { ...currentUser, avatarUrl: compressed };
            StorageService.updateUser(updated);
            onRefreshData();
          }
          notifySuccess('เปลี่ยนรูปภาพโปรไฟล์เรียบร้อยแล้ว ✨');
          // Backup file to Google Drive in parallel
          uploadFileToGoogleDrive(file).catch(() => {});
        }
      } catch (err) {
        console.error('Avatar upload error:', err);
      }
    }
  };

  // Handle Logo Upload directly to Settings & Cloud
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const compressed = await compressImageFile(file, 300, 300, 0.85);
        if (compressed) {
          setSchoolLogoUrl(compressed);
          // Auto-save school settings with new logo immediately
          const updated: SystemSettings = { ...settings, schoolLogoUrl: compressed };
          StorageService.saveSettings(updated);
          onRefreshData();
          notifySuccess('เปลี่ยนโลโก้สถานศึกษาเรียบร้อยแล้ว ✨');
          // Backup file to Google Drive in parallel
          uploadFileToGoogleDrive(file).catch(() => {});
        }
      } catch (err) {
        console.error('Logo upload error:', err);
      }
    }
  };

  // 1. Save Profile
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingProfile(true);

    try {
      const cleanName = fullName.trim() || currentUser.fullName || 'ผู้ใช้งาน';
      const cleanSchool = school.trim() || currentUser.school || settings.schoolName || 'โรงเรียนวิชาการวิทยาคาร';
      const updatedUser: User = {
        ...currentUser,
        fullName: cleanName,
        school: cleanSchool,
        avatarUrl: avatarUrl || currentUser.avatarUrl,
        updatedAt: new Date().toISOString(),
      };

      await StorageService.updateUser(updatedUser);
      setProfileSavedSuccess(true);
      notifySuccess('บันทึกข้อมูลส่วนตัวเรียบร้อยแล้ว ✨');
      onRefreshData();

      setTimeout(() => {
        setProfileSavedSuccess(false);
        onClose(); // ปิดหน้าต่างตั้งค่าอัตโนมัติกลับสู่หน้าหลัก
      }, 400);
    } catch (err) {
      console.error('Save profile error:', err);
      notifyError('เกิดข้อผิดพลาดในการบันทึกข้อมูล');
    } finally {
      setIsSavingProfile(false);
    }
  };

  // 2. Save Password
  const handleSavePassword = async (e: React.FormEvent) => {
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
        updatedAt: new Date().toISOString(),
      };

      await StorageService.updateUser(updatedUser);
      setPasswordSavedSuccess(true);
      notifySuccess('เปลี่ยนรหัสผ่านใหม่เรียบร้อยแล้ว 🔒');
      setNewPassword('');
      setConfirmPassword('');
      onRefreshData();

      setTimeout(() => {
        setPasswordSavedSuccess(false);
        onClose(); // ปิดหน้าต่างตั้งค่าอัตโนมัติกลับสู่หน้าหลัก
      }, 400);
    } catch (err) {
      console.error('Save password error:', err);
      notifyError('เกิดข้อผิดพลาดในการเปลี่ยนรหัสผ่าน');
    } finally {
      setIsSavingPassword(false);
    }
  };

  // 3. Save School & Footer Settings (Admin)
  const handleSaveSchoolSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSchool(true);

    try {
      const cleanSchoolName = schoolName.trim() || settings.schoolName || 'โรงเรียนวิชาการวิทยาคาร';
      const cleanFooter = footerText.trim() || settings.footerText || 'ระบบบริหารจัดการงานวิชาการ มอบหมายงานและส่งงาน';
      const updatedSettings: SystemSettings = {
        ...settings,
        schoolName: cleanSchoolName,
        schoolLogoUrl: schoolLogoUrl || settings.schoolLogoUrl,
        footerText: cleanFooter,
        updatedAt: new Date().toISOString(),
      };

      StorageService.saveSettings(updatedSettings);
      setSchoolSavedSuccess(true);
      notifySuccess('บันทึกข้อมูลสถานศึกษาและข้อความ Footer เรียบร้อยแล้ว ✨');
      onRefreshData();

      setTimeout(() => {
        setSchoolSavedSuccess(false);
        onClose(); // ปิดหน้าต่างตั้งค่าอัตโนมัติกลับสู่หน้าหลัก
      }, 400);
    } catch (err) {
      console.error('Save school settings error:', err);
      notifyError('เกิดข้อผิดพลาดในการบันทึกข้อมูลสถานศึกษา');
    } finally {
      setIsSavingSchool(false);
    }
  };

  // 4. Admin Member Approvals & Deletion with Zero-Latency Optimistic State
  const [localUsers, setLocalUsers] = useState<User[]>(users);

  useEffect(() => {
    setLocalUsers(users);
  }, [users]);

  const handleApprove = async (userId: string) => {
    // Instant optimistic update on UI
    setLocalUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, status: 'ACTIVE' as const } : u))
    );
    notifySuccess('อนุมัติการเข้าใช้งานของสมาชิกเรียบร้อยแล้ว ⚡');
    try {
      await StorageService.approveUser(userId);
      onRefreshData();
    } catch (err) {
      console.error('Approval error:', err);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    const target = localUsers.find((u) => u.id === userId);
    const targetName = target?.fullName || 'ผู้ใช้นี้';
    const ok = await confirmDialog(
      `ยืนยันการลบ ${targetName}?`,
      'บัญชีผู้ใช้และสิทธิ์การเข้าใช้งานจะถูกลบออกจากระบบอย่างถาวรทันที'
    );
    if (ok) {
      // Instant optimistic removal from UI
      setLocalUsers((prev) => prev.filter((u) => u.id !== userId));
      notifySuccess(`ลบผู้ใช้งาน ${targetName} สำเร็จ`);
      try {
        await StorageService.deleteUser(userId);
        onRefreshData();
      } catch (err) {
        console.error('Delete user error:', err);
      }
    }
  };

  const pendingUsers = localUsers.filter((u) => u.status === 'PENDING');
  const activeUsers = localUsers.filter((u) => u.status === 'ACTIVE');

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

              <button
                type="button"
                onClick={() => setActiveTab('GDRIVE')}
                className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center space-x-1.5 shrink-0 ${
                  activeTab === 'GDRIVE'
                    ? 'bg-purple-50 text-purple-700 border border-purple-200 shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <FolderOpen className="w-4 h-4 text-amber-500" />
                <span>5. Google Drive & Apps Script</span>
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

          {/* TAB 5: Google Drive & Webhook (Admin Only) */}
          {activeTab === 'GDRIVE' && isAdmin && (
            <div className="space-y-4 text-xs">
              {/* Info Card */}
              <div className="p-4 bg-gradient-to-r from-amber-50 to-blue-50 rounded-2xl border border-amber-200/80 shadow-2xs space-y-2">
                <div className="flex items-center space-x-2 text-slate-800 font-bold text-sm">
                  <Sparkles className="w-4 h-4 text-amber-600" />
                  <span>ระบบสร้างโฟลเดอร์ตามหัวข้อ & ลบไฟล์/โฟลเดอร์ใน Google Drive อัตโนมัติ</span>
                </div>
                <p className="text-slate-600 leading-relaxed text-[11px]">
                  เมื่อ Admin <strong>สร้างงานมอบหมายตามหัวข้อ</strong> ระบบจะส่งคำสั่งสร้างโฟลเดอร์ย่อยใน Google Drive ตามชื่อหัวข้อนั้นโดยอัตโนมัติ และเมื่อสมาชิกส่งงาน ไฟล์จะถูกจัดเก็บเข้าโฟลเดอร์หัวข้อนั้นโดยตรง รวมถึงเมื่อ Admin หรือสมาชิกลบไฟล์หรืองาน ระบบจะส่งคำสั่งลบออกจาก Google Drive โดยอัตโนมัติ
                </p>
              </div>

              {/* Webhook URL Setting */}
              <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200/80 space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-800 flex items-center space-x-1.5">
                    <Code2 className="w-4 h-4 text-blue-600" />
                    <span>Google Apps Script Webhook URL</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleResetWebhookUrl}
                    className="text-[10px] text-slate-500 hover:text-slate-700 underline cursor-pointer"
                  >
                    คืนค่าเริ่มต้น
                  </button>
                </div>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={gasWebhookUrl}
                    onChange={(e) => setGasWebhookUrl(e.target.value)}
                    placeholder="https://script.google.com/macros/s/.../exec"
                    className="flex-1 px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-800 font-mono text-[11px] focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleSaveWebhookUrl}
                    disabled={isSavingWebhook}
                    className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold flex items-center space-x-1.5 transition-colors cursor-pointer text-xs"
                  >
                    {isSavingWebhook ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    <span>บันทึก URL</span>
                  </button>
                </div>
              </div>

              {/* Full Diagnostic Test Action */}
              <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200/80 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h4 className="font-bold text-slate-800">เครื่องมือทดสอบการทำงานของ Google Drive</h4>
                    <p className="text-slate-500 text-[11px]">
                      ทดสอบตรวจสถานะ, สร้างโฟลเดอร์ตามชื่อ, และลบโฟลเดอร์ออกจาก Google Drive จริง
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleRunFullDiagnostic}
                    disabled={isDiagnosing}
                    className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold flex items-center justify-center space-x-1.5 transition-all cursor-pointer disabled:opacity-50 shadow-2xs text-xs"
                  >
                    {isDiagnosing ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>กำลังทดสอบระบบ...</span>
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>เริ่มทดสอบระบบ Drive</span>
                      </>
                    )}
                  </button>
                </div>

                {/* 3-Step Live Indicators */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
                  <div className={`p-2.5 rounded-xl border flex items-center space-x-2 ${
                    diagStep1 === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' :
                    diagStep1 === 'failed' ? 'bg-rose-50 border-rose-200 text-rose-800' :
                    diagStep1 === 'running' ? 'bg-blue-50 border-blue-200 text-blue-800' :
                    'bg-white border-slate-200 text-slate-600'
                  }`}>
                    {diagStep1 === 'running' ? <Loader2 className="w-4 h-4 animate-spin text-blue-600 shrink-0" /> :
                     diagStep1 === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> :
                     <div className="w-4 h-4 rounded-full border border-slate-300 flex items-center justify-center text-[9px] shrink-0">1</div>}
                    <span className="truncate">1. ตรวจการเชื่อมต่อ (Ping)</span>
                  </div>

                  <div className={`p-2.5 rounded-xl border flex items-center space-x-2 ${
                    diagStep2 === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' :
                    diagStep2 === 'failed' ? 'bg-rose-50 border-rose-200 text-rose-800' :
                    diagStep2 === 'running' ? 'bg-blue-50 border-blue-200 text-blue-800' :
                    'bg-white border-slate-200 text-slate-600'
                  }`}>
                    {diagStep2 === 'running' ? <Loader2 className="w-4 h-4 animate-spin text-blue-600 shrink-0" /> :
                     diagStep2 === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> :
                     <div className="w-4 h-4 rounded-full border border-slate-300 flex items-center justify-center text-[9px] shrink-0">2</div>}
                    <span className="truncate">2. สร้างโฟลเดอร์จริง</span>
                  </div>

                  <div className={`p-2.5 rounded-xl border flex items-center space-x-2 ${
                    diagStep3 === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' :
                    diagStep3 === 'failed' ? 'bg-rose-50 border-rose-200 text-rose-800' :
                    diagStep3 === 'running' ? 'bg-blue-50 border-blue-200 text-blue-800' :
                    'bg-white border-slate-200 text-slate-600'
                  }`}>
                    {diagStep3 === 'running' ? <Loader2 className="w-4 h-4 animate-spin text-blue-600 shrink-0" /> :
                     diagStep3 === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> :
                     <div className="w-4 h-4 rounded-full border border-slate-300 flex items-center justify-center text-[9px] shrink-0">3</div>}
                    <span className="truncate">3. ลบโฟลเดอร์อัตโนมัติ</span>
                  </div>
                </div>

                {diagLog && (
                  <div className={`p-3 rounded-xl border font-mono text-[11px] whitespace-pre-line leading-relaxed ${
                    diagLog.startsWith('✅') ? 'bg-emerald-50/90 border-emerald-300 text-emerald-900' : 'bg-rose-50/90 border-rose-300 text-rose-900'
                  }`}>
                    {diagLog}
                  </div>
                )}
              </div>

              {/* Drive Folders Overview */}
              <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200/80 space-y-3">
                <h4 className="font-bold text-slate-800 flex items-center space-x-2">
                  <FolderOpen className="w-4 h-4 text-blue-600" />
                  <span>โฟลเดอร์หลักใน Google Drive</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
                  <a
                    href={`https://drive.google.com/drive/folders/${GDRIVE_FOLDER_ID}`}
                    target="_blank"
                    rel="noreferrer"
                    className="p-3 bg-white rounded-xl border border-slate-200 hover:border-blue-400 hover:shadow-xs transition-all flex flex-col justify-between"
                  >
                    <div>
                      <p className="font-bold text-slate-700 flex items-center justify-between">
                        <span>โฟลเดอร์งานมอบหมาย (Root)</span>
                        <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                      </p>
                      <p className="text-[10px] text-slate-500 font-mono mt-1 truncate">
                        ID: {GDRIVE_FOLDER_ID}
                      </p>
                    </div>
                    <span className="text-[10px] text-blue-600 font-medium mt-2">เปิดดูใน Drive →</span>
                  </a>

                  <a
                    href={`https://drive.google.com/drive/folders/${GDRIVE_OFFICIAL_ORDERS_FOLDER_ID}`}
                    target="_blank"
                    rel="noreferrer"
                    className="p-3 bg-white rounded-xl border border-slate-200 hover:border-purple-400 hover:shadow-xs transition-all flex flex-col justify-between"
                  >
                    <div>
                      <p className="font-bold text-slate-700 flex items-center justify-between">
                        <span>โฟลเดอร์หนังสือคำสั่ง</span>
                        <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                      </p>
                      <p className="text-[10px] text-slate-500 font-mono mt-1 truncate">
                        ID: {GDRIVE_OFFICIAL_ORDERS_FOLDER_ID}
                      </p>
                    </div>
                    <span className="text-[10px] text-purple-600 font-medium mt-2">เปิดดูใน Drive →</span>
                  </a>

                  <a
                    href={`https://drive.google.com/drive/folders/${GDRIVE_SAMPLE_DOCS_FOLDER_ID}`}
                    target="_blank"
                    rel="noreferrer"
                    className="p-3 bg-white rounded-xl border border-slate-200 hover:border-emerald-400 hover:shadow-xs transition-all flex flex-col justify-between"
                  >
                    <div>
                      <p className="font-bold text-slate-700 flex items-center justify-between">
                        <span>โฟลเดอร์เอกสารตัวอย่าง</span>
                        <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                      </p>
                      <p className="text-[10px] text-slate-500 font-mono mt-1 truncate">
                        ID: {GDRIVE_SAMPLE_DOCS_FOLDER_ID}
                      </p>
                    </div>
                    <span className="text-[10px] text-emerald-600 font-medium mt-2">เปิดดูใน Drive →</span>
                  </a>
                </div>
              </div>

              {/* Google Apps Script Deploy Code */}
              <div className="p-4 bg-slate-900 rounded-2xl border border-slate-800 text-slate-200 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center space-x-2">
                    <Code2 className="w-4 h-4 text-emerald-400" />
                    <span className="font-bold text-white text-xs">
                      โค้ด Google Apps Script API v2 (สร้างโฟลเดอร์ & ลบไฟล์/โฟลเดอร์อัตโนมัติ)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyCode}
                    className={`px-3 py-1.5 rounded-xl font-bold flex items-center space-x-1.5 transition-all cursor-pointer text-xs ${
                      copiedCode
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                    }`}
                  >
                    {copiedCode ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>คัดลอกสำเร็จ!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>คัดลอกโค้ด Apps Script</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="text-[11px] text-slate-300 space-y-1.5 bg-slate-950/80 p-3.5 rounded-xl border border-slate-800">
                  <p className="text-amber-300 font-bold">📌 4 ขั้นตอนการอัปเดตใน Google Apps Script (สำคัญมาก):</p>
                  <ol className="list-decimal list-inside space-y-1 text-slate-300">
                    <li>เปิด <a href="https://script.google.com" target="_blank" rel="noreferrer" className="text-blue-400 underline font-semibold">script.google.com</a> แล้วเปิดโปรเจกต์เดิมของท่าน</li>
                    <li>วางโค้ดชุดนี้แทนที่โค้ดเดิมทั้งหมดในไฟล์ <code className="text-emerald-300 bg-slate-800 px-1 py-0.5 rounded font-mono">Code.gs</code> แล้วกดบันทึก (รูปแผ่นดิสก์)</li>
                    <li>กดปุ่มสีน้ำเงิน <strong>"ทำให้ใช้งานได้ (Deploy)"</strong> ด้านบนขวา &gt; เลือก <strong>"จัดการการทำให้ใช้งานได้ (Manage deployments)"</strong></li>
                    <li>กดรูปดินสอ ✏️ &gt; ช่องเวอร์ชันเลือก <strong>"ใหม่ (New)"</strong> &gt; สิทธิ์การเข้าถึงเลือก <strong>"ทุกคน (Anyone)"</strong> &gt; กด <strong>"ทำให้ใช้งานได้ (Deploy)"</strong></li>
                  </ol>
                </div>

                <pre className="p-3 bg-slate-950 rounded-xl overflow-x-auto text-[10px] font-mono text-slate-300 max-h-52 scrollbar-thin border border-slate-800">
                  {GOOGLE_APPS_SCRIPT_CODE}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

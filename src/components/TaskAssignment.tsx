import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Plus,
  PlusCircle,
  Megaphone,
  Calendar,
  UploadCloud,
  FileText,
  FileSpreadsheet,
  File,
  Image as ImageIcon,
  Trash2,
  CheckCircle2,
  Clock,
  AlertTriangle,
  FolderOpen,
  Edit3,
  HardDrive,
  Eye,
  Check,
  X,
  FileCheck,
  Filter,
  Layers,
  Sparkles,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import {
  User,
  Task,
  Announcement,
  Submission,
  SubmissionFile,
  AnnouncementType,
} from '../types';
import {
  StorageService,
  GDRIVE_FOLDER_URL,
} from '../services/storage';
import { uploadFileToGoogleDrive, createGoogleDriveFolder } from '../services/driveUpload';
import {
  notifySuccess,
  notifyError,
  notifyWarning,
  notifyInfo,
  confirmDialog,
} from '../services/notifications';
import { ThaiDatePicker } from './ThaiDatePicker';

interface TaskAssignmentProps {
  currentUser: User | null;
  tasks: Task[];
  announcements: Announcement[];
  submissions: Submission[];
  onRefreshData: () => void;
  preSelectedTask?: Task | null;
}

export const TaskAssignment: React.FC<TaskAssignmentProps> = ({
  currentUser,
  tasks = [],
  announcements = [],
  submissions = [],
  onRefreshData,
  preSelectedTask,
}) => {
  const isAdmin = currentUser?.role === 'ADMIN';

  // Safe arrays
  const safeTasks = Array.isArray(tasks) ? tasks : [];
  const safeAnnouncements = Array.isArray(announcements) ? announcements : [];
  const safeSubmissions = Array.isArray(submissions) ? submissions : [];

  // Admin Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalCategory, setModalCategory] = useState<'TASK' | 'ANNOUNCEMENT'>('TASK');
  const [modalTitle, setModalTitle] = useState('');
  const [modalDescription, setModalDescription] = useState('');
  const [modalDate, setModalDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split('T')[0];
  });
  const [modalAnnType, setModalAnnType] = useState<AnnouncementType>('ACTIVITY');
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Admin List Filter Tab
  const [adminListFilter, setAdminListFilter] = useState<'ALL' | 'TASK' | 'ANNOUNCEMENT'>('ALL');

  // Member Assigned Tasks Filter (only pending tasks for current member, sorted with nearest due date first)
  const memberPendingTasks = safeTasks
    .filter((task) => {
      if (!task || !task.id) return false;
      // Show only tasks that current member has NOT submitted yet
      if (!currentUser) return true;
      const hasSubmitted = safeSubmissions.some(
        (s) => s && s.taskId === task.id && s.memberId === currentUser.id
      );
      return !hasSubmitted;
    })
    .sort((a, b) => {
      // Nearest due date on top (ascending order of dueDate)
      const dateA = a?.dueDate || '';
      const dateB = b?.dueDate || '';
      return dateA.localeCompare(dateB);
    });

  // Member Submissions (tasks that member already submitted)
  const memberCompletedSubmissions = safeSubmissions.filter(
    (s) => s && s.memberId === currentUser?.id
  );

  // Active submission modal or selected task for member
  const [activeTaskForSubmission, setActiveTaskForSubmission] = useState<Task | null>(null);

  // Submission Form State (Member)
  const [submissionSubject, setSubmissionSubject] = useState('');
  const [submissionDescription, setSubmissionDescription] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState<SubmissionFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle opening submission modal for a specific task
  const handleOpenSubmissionModal = (task: Task) => {
    if (!task) return;
    setActiveTaskForSubmission(task);
    // Pre-fill subject with task title if empty
    setSubmissionSubject(task.title || '');
    setSubmissionDescription('');
    setUploadedFiles([]);
  };

  useEffect(() => {
    if (preSelectedTask && !isAdmin) {
      handleOpenSubmissionModal(preSelectedTask);
    }
  }, [preSelectedTask, isAdmin]);

  const isPastDue = (dateStr?: string | null) => {
    if (!dateStr || typeof dateStr !== 'string') return false;
    const todayStr = new Date().toISOString().split('T')[0];
    return dateStr < todayStr;
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + (sizes[i] || 'B');
  };

  const daysOfWeekThai = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
  const formatThaiDate = (dateStr?: string | null, includeDay: boolean = false) => {
    if (!dateStr || typeof dateStr !== 'string') return '-';
    try {
      const parts = dateStr.split('-');
      if (parts.length < 3) return dateStr;
      const [y, m, d] = parts;
      const parsedYear = parseInt(y, 10);
      const parsedMonth = parseInt(m, 10) - 1;
      const parsedDay = parseInt(d, 10);
      if (isNaN(parsedYear) || isNaN(parsedMonth) || isNaN(parsedDay)) return dateStr;
      const thaiYear = parsedYear + 543;

      const dateObj = new Date(parsedYear, parsedMonth, parsedDay);
      const dayOfWeekIndex = dateObj.getDay();
      const shortDay = daysOfWeekThai[dayOfWeekIndex] || '';

      const dayClean = String(parsedDay).padStart(2, '0');
      const monthClean = String(parsedMonth + 1).padStart(2, '0');

      if (includeDay && shortDay) {
        return `${shortDay} ${dayClean}/${monthClean}/${parsedYear} (พ.ศ. ${thaiYear})`;
      }
      return `${dayClean}/${monthClean}/${parsedYear}`;
    } catch {
      return dateStr || '-';
    }
  };

  // Open modal for new creation
  const handleOpenCreateModal = (category: 'TASK' | 'ANNOUNCEMENT' = 'TASK') => {
    setEditingItemId(null);
    setModalCategory(category);
    setModalTitle('');
    setModalDescription('');
    const d = new Date();
    d.setDate(d.getDate() + 7);
    setModalDate(d.toISOString().split('T')[0]);
    setModalAnnType('ACTIVITY');
    setIsModalOpen(true);
  };

  // Open modal for editing a task
  const handleOpenEditTask = (task: Task) => {
    setEditingItemId(task.id);
    setModalCategory('TASK');
    setModalTitle(task.title);
    setModalDescription(task.description || '');
    setModalDate(task.dueDate);
    setIsModalOpen(true);
  };

  // Open modal for editing an announcement
  const handleOpenEditAnnouncement = (ann: Announcement) => {
    setEditingItemId(ann.id);
    setModalCategory('ANNOUNCEMENT');
    setModalTitle(ann.title);
    setModalDescription(ann.details || '');
    setModalDate(ann.date);
    setModalAnnType(ann.type);
    setIsModalOpen(true);
  };

  // Save Modal Form (Handles both Task & Announcement)
  const handleSaveModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalTitle.trim() || !modalDate) {
      notifyError('กรุณากรอกหัวข้อและกำหนดวันที่ให้ครบถ้วน');
      return;
    }

    setIsSaving(true);

    try {
      if (modalCategory === 'TASK') {
        if (editingItemId) {
          const existing = tasks.find((t) => t.id === editingItemId);
          if (existing) {
            StorageService.updateTask({
              ...existing,
              title: modalTitle.trim(),
              category: 'งานวิชาการ',
              description: modalDescription.trim(),
              dueDate: modalDate,
            });
            notifySuccess('อัปเดตข้อมูลงานที่มอบหมายสำเร็จ ✨');
          }
        } else {
          // Fast task creation with dedicated storage folder
          const folderRes = await createGoogleDriveFolder(modalTitle.trim());

          StorageService.createTask({
            title: modalTitle.trim(),
            category: 'งานวิชาการ',
            description: modalDescription.trim(),
            dueDate: modalDate,
            assignedBy: currentUser?.fullName || 'ผู้ดูแลระบบวิชาการ',
            gDriveFolderId: folderRes.folderId,
            gDriveFolderUrl: folderRes.folderUrl,
          });
          notifySuccess(`บันทึกการมอบหมายงานสำเร็จ เรียบร้อยแล้ว ✨`);
        }
      } else {
        // Announcement
        if (editingItemId) {
          const existing = announcements.find((a) => a.id === editingItemId);
          if (existing) {
            StorageService.updateAnnouncement({
              ...existing,
              title: modalTitle.trim(),
              details: modalDescription.trim(),
              date: modalDate,
              type: modalAnnType,
            });
            notifySuccess('อัปเดตประกาศแจ้งเพื่อทราบสำเร็จ ✨');
          }
        } else {
          StorageService.createAnnouncement({
            title: modalTitle.trim(),
            details: modalDescription.trim(),
            date: modalDate,
            type: modalAnnType,
            createdBy: currentUser?.fullName || 'ผู้ดูแลระบบวิชาการ',
          });
          notifySuccess('สร้างประกาศแจ้งเพื่อทราบสำเร็จ 📢✨');
        }
      }

      setIsModalOpen(false);
      onRefreshData();
    } catch (err) {
      console.error('Save error:', err);
      notifyError('เกิดข้อผิดพลาดในการบันทึกข้อมูล');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    const ok = await confirmDialog(
      'ยืนยันการลบงานนี้?',
      'การลบงานจะทำให้ข้อมูลและรายงานที่เกี่ยวข้องถูกลบด้วย'
    );
    if (ok) {
      StorageService.deleteTask(taskId);
      notifySuccess('ลบงานมอบหมายสำเร็จ');
      onRefreshData();
    }
  };

  const handleDeleteAnnouncement = async (id: string) => {
    const ok = await confirmDialog('ยืนยันการลบประกาศนี้?', 'ประกาศจะถูกนำออกจากปฏิทินและหน้าแรก');
    if (ok) {
      StorageService.deleteAnnouncement(id);
      notifySuccess('ลบประกาศสำเร็จ');
      onRefreshData();
    }
  };

  // --- Member Multi-file Upload (Parallel Fast Upload) ---
  const handleFilesChosen = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setIsUploading(true);

    const fileList = Array.from(files);

    try {
      const uploadPromises = fileList.map(async (file, i) => {
        try {
          const result = await uploadFileToGoogleDrive(file);
          return {
            id: `file-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 7)}`,
            name: file.name,
            size: file.size,
            type: file.type || 'application/octet-stream',
            gDriveUrl: result.fileUrl || GDRIVE_FOLDER_URL,
            previewUrl: result.downloadUrl,
            uploadedAt: new Date().toISOString(),
          } as SubmissionFile;
        } catch (err) {
          console.error('File upload error:', err);
          return {
            id: `file-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 7)}`,
            name: file.name,
            size: file.size,
            type: file.type || 'application/octet-stream',
            gDriveUrl: GDRIVE_FOLDER_URL,
            uploadedAt: new Date().toISOString(),
          } as SubmissionFile;
        }
      });

      const uploadedResults = await Promise.all(uploadPromises);
      setUploadedFiles((prev) => [...prev, ...uploadedResults]);
      notifySuccess(`แนบ ${uploadedResults.length} ไฟล์เรียบร้อยแล้ว ✨`);
    } catch (err) {
      console.error('Parallel upload error:', err);
      notifyError('เกิดข้อผิดพลาดในการแนบไฟล์');
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveFile = (fileId: string) => {
    setUploadedFiles((prev) => prev.filter((f) => f.id !== fileId));
    notifyInfo('ลบไฟล์ออกจากรายการแล้ว');
  };

  // --- Member Submit Task ---
  const handleSubmitWork = (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentUser) {
      notifyError('กรุณาเข้าสู่ระบบก่อนส่งงาน');
      return;
    }

    if (!activeTaskForSubmission) {
      notifyError('กรุณาเลือกหัวข้องานที่ต้องการส่ง');
      return;
    }

    if (!submissionSubject.trim()) {
      notifyError('กรุณากรอกหัวข้องานที่ส่ง (จำเป็น)');
      return;
    }

    if (uploadedFiles.length === 0) {
      notifyWarning('กรุณาแนบไฟล์งานอย่างน้อย 1 ไฟล์');
      return;
    }

    StorageService.createSubmission({
      taskId: activeTaskForSubmission.id,
      taskTitle: activeTaskForSubmission.title,
      memberId: currentUser.id,
      memberName: currentUser.fullName,
      memberSchool: currentUser.school,
      memberAvatar: currentUser.avatarUrl,
      subject: submissionSubject.trim(),
      description: submissionDescription.trim(),
      files: uploadedFiles,
    });

    // Confetti celebration effect!
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 },
    });

    notifySuccess(`ส่งงาน "${activeTaskForSubmission.title}" เข้าสู่ระบบเรียบร้อยแล้ว! 🎉`);
    setActiveTaskForSubmission(null);
    onRefreshData();
  };

  return (
    <div className="space-y-6">
      {/* ================= ADMIN VIEW ================= */}
      {isAdmin && (
        <div className="space-y-6">
          {/* Admin Header: Summary + Prominent '+' Button */}
          <div className="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center space-x-3.5">
              <div className="w-12 h-12 bg-purple-600 text-white rounded-2xl flex items-center justify-center shadow-md shrink-0 ring-4 ring-purple-100">
                <Send className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-lg sm:text-xl font-bold text-slate-800 tracking-tight">
                  มอบหมายงาน & ส่งงาน
                </h1>
                <p className="text-xs sm:text-sm text-slate-500">
                  จัดการรายการงานที่ได้สั่งการและประกาศแจ้งเพื่อทราบทั้งหมดในระบบ
                </p>
              </div>
            </div>

            {/* Prominent '+' Button */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleOpenCreateModal('TASK')}
                className="btn-glow-purple px-4 sm:px-5 py-2.5 text-xs sm:text-sm font-bold text-white bg-purple-600 hover:bg-purple-700 active:scale-95 transition-all rounded-xl shadow-md inline-flex items-center space-x-2 cursor-pointer"
              >
                <div className="w-5 h-5 bg-white/20 rounded-lg flex items-center justify-center">
                  <Plus className="w-4 h-4 text-white" />
                </div>
                <span>มอบหมายงาน / สร้างประกาศใหม่</span>
              </button>
            </div>
          </div>

          {/* List Filter Tabs */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center space-x-1.5 bg-slate-100/80 p-1 rounded-2xl border border-slate-200">
              <button
                type="button"
                onClick={() => setAdminListFilter('ALL')}
                className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                  adminListFilter === 'ALL'
                    ? 'bg-white text-slate-800 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                ทั้งหมด ({safeTasks.length + safeAnnouncements.length})
              </button>
              <button
                type="button"
                onClick={() => setAdminListFilter('TASK')}
                className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center space-x-1.5 ${
                  adminListFilter === 'TASK'
                    ? 'bg-white text-purple-700 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <span>📝 งานที่มอบหมาย</span>
                <span className="bg-purple-100 text-purple-800 text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                  {safeTasks.length}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setAdminListFilter('ANNOUNCEMENT')}
                className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center space-x-1.5 ${
                  adminListFilter === 'ANNOUNCEMENT'
                    ? 'bg-white text-amber-800 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <span>📢 ประกาศแจ้งเพื่อทราบ</span>
                <span className="bg-amber-100 text-amber-800 text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                  {safeAnnouncements.length}
                </span>
              </button>
            </div>

            <div className="text-xs text-slate-400 font-medium">
              แสดงผลวันที่: <span className="font-mono text-slate-600 font-semibold">DD/MM/YYYY</span> (วัน/เดือน/ปี)
            </div>
          </div>

          {/* Assigned Tasks Table */}
          {(adminListFilter === 'ALL' || adminListFilter === 'TASK') && (
            <div className="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-6 shadow-xs space-y-3">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center space-x-2">
                  <span className="text-base font-bold text-slate-800">
                    รายการงานที่มอบหมายแล้ว
                  </span>
                  <span className="text-xs font-bold bg-purple-50 text-purple-700 px-2 py-0.5 rounded-md border border-purple-100">
                    {safeTasks.length} รายการ
                  </span>
                </div>
              </div>

              {safeTasks.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs">
                  ยังไม่มีรายการงานที่มอบหมาย กดปุ่ม "+" ด้านบนเพื่อสร้างงานใหม่
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs sm:text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-600">
                        <th className="py-3 px-3 rounded-l-xl font-bold">หมวดหมู่ & หัวข้องาน</th>
                        <th className="py-3 px-3 font-bold">กำหนดส่ง (DD/MM/YYYY)</th>
                        <th className="py-3 px-3 font-bold">Google Drive</th>
                        <th className="py-3 px-3 font-bold">สถานะการส่งงาน</th>
                        <th className="py-3 px-3 rounded-r-xl font-bold text-right">การจัดการ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {safeTasks.map((task) => {
                        const taskSubmissions = safeSubmissions.filter((s) => s && s.taskId === task.id);
                        return (
                          <tr key={task.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-3.5 px-3">
                              <div className="flex items-center space-x-2">
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-100 whitespace-nowrap">
                                  งานมอบหมาย
                                </span>
                                <p className="font-bold text-slate-800 line-clamp-1">{task.title}</p>
                              </div>
                              <p className="text-xs text-slate-500 line-clamp-1 mt-0.5 pl-0.5">
                                {task.description || 'ไม่มีคำอธิบายเพิ่มเติม'}
                              </p>
                            </td>
                            <td className="py-3.5 px-3 whitespace-nowrap font-mono font-semibold text-slate-800">
                              {formatThaiDate(task.dueDate)}
                            </td>
                            <td className="py-3.5 px-3 whitespace-nowrap">
                              {task.gDriveFolderUrl ? (
                                <a
                                  href={task.gDriveFolderUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2.5 py-1 rounded-lg transition-colors inline-flex items-center space-x-1.5"
                                  title="เปิดโฟลเดอร์งานนี้ใน Google Drive"
                                >
                                  <HardDrive className="w-3.5 h-3.5 text-emerald-600" />
                                  <span>เปิดโฟลเดอร์</span>
                                </a>
                              ) : (
                                <span className="text-xs text-slate-400">-</span>
                              )}
                            </td>
                            <td className="py-3.5 px-3 whitespace-nowrap">
                              <span className="inline-flex items-center space-x-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                <span>ส่งแล้ว {taskSubmissions.length} คน</span>
                              </span>
                            </td>
                            <td className="py-3.5 px-3 text-right whitespace-nowrap">
                              <div className="inline-flex items-center space-x-1">
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditTask(task)}
                                  className="p-1.5 text-slate-500 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors cursor-pointer"
                                  title="แก้ไขงาน"
                                >
                                  <Edit3 className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteTask(task.id)}
                                  className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                  title="ลบงาน"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Announcements List */}
          {(adminListFilter === 'ALL' || adminListFilter === 'ANNOUNCEMENT') && (
            <div className="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-6 shadow-xs space-y-3">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center space-x-2">
                  <span className="text-base font-bold text-slate-800">
                    รายการประกาศแจ้งเพื่อทราบทั้งหมด
                  </span>
                  <span className="text-xs font-bold bg-amber-50 text-amber-700 px-2 py-0.5 rounded-md border border-amber-100">
                    {safeAnnouncements.length} รายการ
                  </span>
                </div>
              </div>

              {safeAnnouncements.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs">
                  ยังไม่มีประกาศแจ้งเพื่อทราบ กดปุ่ม "+" เพื่อสร้างประกาศใหม่
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {safeAnnouncements.map((ann) => (
                    <div
                      key={ann.id}
                      className="p-4 rounded-2xl border border-amber-200 bg-amber-50/40 flex items-start justify-between gap-3 hover:border-amber-300 transition-colors"
                    >
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex items-center space-x-2">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-200">
                            {ann.type === 'HOLIDAY'
                              ? '🏖️ วันหยุดราชการ'
                              : ann.type === 'ACTIVITY'
                              ? '🎯 กิจกรรม/การประชุม'
                              : '📢 ข่าวสารทั่วไป'}
                          </span>
                          <span className="text-xs font-mono font-bold text-amber-900">
                            {formatThaiDate(ann.date)}
                          </span>
                        </div>
                        <p className="text-sm font-bold text-slate-900 line-clamp-1">{ann.title}</p>
                        <p className="text-xs text-slate-600 line-clamp-2">
                          {ann.details || 'ไม่มีรายละเอียดเพิ่มเติม'}
                        </p>
                      </div>

                      <div className="inline-flex items-center space-x-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleOpenEditAnnouncement(ann)}
                          className="p-1.5 text-slate-400 hover:text-amber-700 hover:bg-amber-100 rounded-lg transition-colors cursor-pointer"
                          title="แก้ไขประกาศ"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteAnnouncement(ann.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="ลบประกาศ"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ================= MODAL DIALOG (Admin '+' / Edit) ================= */}
          {isModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
              <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto space-y-5 animate-in zoom-in-95 duration-150">
                {/* Modal Header */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center space-x-3">
                    <div
                      className={`w-10 h-10 rounded-2xl flex items-center justify-center text-white ${
                        modalCategory === 'TASK' ? 'bg-purple-600' : 'bg-amber-500'
                      }`}
                    >
                      {modalCategory === 'TASK' ? (
                        <Send className="w-5 h-5" />
                      ) : (
                        <Megaphone className="w-5 h-5" />
                      )}
                    </div>
                    <div>
                      <h2 className="text-base sm:text-lg font-bold text-slate-900">
                        {editingItemId
                          ? modalCategory === 'TASK'
                            ? 'แก้ไขข้อมูลงานมอบหมาย'
                            : 'แก้ไขประกาศแจ้งเพื่อทราบ'
                          : 'มอบหมายงาน / สร้างประกาศใหม่'}
                      </h2>
                      <p className="text-xs text-slate-400">
                        กรอกข้อมูลรายละเอียดและกำหนดวันส่งหรือวันประกาศ
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Modal Form */}
                <form onSubmit={handleSaveModal} className="space-y-4">
                  {/* 1. Category Selection */}
                  {!editingItemId && (
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700 block">
                        1. หมวดหมู่ <span className="text-rose-500">*</span>
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setModalCategory('TASK')}
                          className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex items-center space-x-2.5 ${
                            modalCategory === 'TASK'
                              ? 'border-purple-500 bg-purple-50/80 text-purple-900 ring-2 ring-purple-200'
                              : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                          }`}
                        >
                          <div
                            className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                              modalCategory === 'TASK'
                                ? 'bg-purple-600 text-white'
                                : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            <Send className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="text-xs font-bold leading-tight">มอบหมายงาน</p>
                            <p className="text-[10px] text-slate-500">มีกำหนดส่ง & เก็บลง Drive</p>
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => setModalCategory('ANNOUNCEMENT')}
                          className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex items-center space-x-2.5 ${
                            modalCategory === 'ANNOUNCEMENT'
                              ? 'border-amber-500 bg-amber-50/80 text-amber-900 ring-2 ring-amber-200'
                              : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                          }`}
                        >
                          <div
                            className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                              modalCategory === 'ANNOUNCEMENT'
                                ? 'bg-amber-500 text-white'
                                : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            <Megaphone className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="text-xs font-bold leading-tight">ประกาศให้ทราบ</p>
                            <p className="text-[10px] text-slate-500">แจ้งข่าวสาร / กิจกรรม</p>
                          </div>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* 2. Title */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">
                      2. {modalCategory === 'TASK' ? 'หัวข้องานที่มอบหมาย' : 'หัวข้อประกาศ'}{' '}
                      <span className="text-rose-500">* (จำเป็น)</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder={
                        modalCategory === 'TASK'
                          ? 'เช่น ส่งแผนการจัดการเรียนรู้ ประจำภาคเรียนที่ 1/2569'
                          : 'เช่น แจ้งกำหนดการประชุมวิชาการ หรือ วันหยุดราชการ'
                      }
                      value={modalTitle}
                      onChange={(e) => setModalTitle(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all outline-hidden font-medium"
                    />
                  </div>

                  {/* Announcement Type (if category is Announcement) */}
                  {modalCategory === 'ANNOUNCEMENT' && (
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700">ประเภทประกาศ</label>
                      <select
                        value={modalAnnType}
                        onChange={(e) => setModalAnnType(e.target.value as AnnouncementType)}
                        className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all outline-hidden font-medium"
                      >
                        <option value="ACTIVITY">🎯 กิจกรรม / การประชุม</option>
                        <option value="HOLIDAY">🏖️ วันหยุดราชการ</option>
                        <option value="ANNOUNCEMENT">📢 ข่าวสารทั่วไป</option>
                      </select>
                    </div>
                  )}

                  {/* 3. Description (Optional) */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                      <span>3. รายละเอียดคำอธิบาย</span>
                      <span className="text-slate-400 font-normal text-[11px]">(ไม่บังคับ)</span>
                    </label>
                    <textarea
                      rows={3}
                      placeholder={
                        modalCategory === 'TASK'
                          ? 'ระบุรูปแบบเอกสาร ไฟล์ที่ต้องการ หรือเงื่อนไขการส่งงาน (ไม่บังคับ)...'
                          : 'ระบุรายละเอียด กำหนดการ สถานที่ หรือสิ่งที่บุคลากรควรทราบ (ไม่บังคับ)...'
                      }
                      value={modalDescription}
                      onChange={(e) => setModalDescription(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all outline-hidden"
                    />
                  </div>

                  {/* 4. Due Date / Event Date (dd/mm/yyyy with ThaiDatePicker) */}
                  <div className="space-y-1.5">
                    <ThaiDatePicker
                      value={modalDate}
                      onChange={(val) => setModalDate(val)}
                      label={`4. ${
                        modalCategory === 'TASK'
                          ? 'กำหนดวันส่งงาน (dd/mm/yyyy)'
                          : 'วันที่เกิดกิจกรรม / วันประกาศ (dd/mm/yyyy)'
                      }`}
                      required
                      colorScheme={modalCategory === 'TASK' ? 'purple' : 'amber'}
                    />
                    <p className="text-[11px] text-slate-500 pl-1">
                      ระบบแสดงผลตามรูปแบบ วัน/เดือน/ปี (dd/mm/yyyy) เช่น{' '}
                      <span className="font-semibold text-purple-700">
                        {formatThaiDate(modalDate, true)}
                      </span>
                    </p>
                  </div>

                  {/* Footer Actions */}
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
                    <button
                      type="button"
                      onClick={() => setIsModalOpen(false)}
                      className="px-4 py-2.5 text-xs sm:text-sm font-semibold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
                    >
                      ยกเลิก
                    </button>
                    <button
                      type="submit"
                      disabled={isSaving}
                      className={`px-6 py-2.5 text-xs sm:text-sm font-bold text-white rounded-xl transition-all shadow-md inline-flex items-center space-x-2 cursor-pointer ${
                        modalCategory === 'TASK'
                          ? 'bg-purple-600 hover:bg-purple-700'
                          : 'bg-amber-600 hover:bg-amber-700'
                      } ${isSaving ? 'opacity-70 cursor-not-allowed' : ''}`}
                    >
                      {isSaving ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      ) : (
                        <Check className="w-4 h-4" />
                      )}
                      <span>
                        {isSaving
                          ? 'กำลังบันทึก...'
                          : editingItemId
                          ? 'บันทึกการแก้ไข'
                          : modalCategory === 'TASK'
                          ? 'ยืนยันการมอบหมายงาน'
                          : 'ยืนยันเผยแพร่ประกาศ'}
                      </span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ================= MEMBER VIEW ================= */}
      {!isAdmin && (
        <div className="space-y-6">
          {/* Member Header */}
          <div className="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-6 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center space-x-3.5">
                <div className="w-12 h-12 bg-emerald-600 text-white rounded-2xl flex items-center justify-center shadow-md shrink-0 ring-4 ring-emerald-100">
                  <Send className="w-6 h-6" />
                </div>
                <div>
                  <h1 className="text-lg sm:text-xl font-bold text-slate-800 tracking-tight">
                    มอบหมายงาน & ส่งงาน
                  </h1>
                  <p className="text-xs sm:text-sm text-slate-500">
                    รายการงานที่ Admin มอบหมายเฉพาะที่คุณยังไม่ได้ส่ง (เรียงตามกำหนดส่งที่ใกล้จะมาถึงก่อน)
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <span className="inline-flex items-center space-x-1.5 bg-emerald-50 text-emerald-800 border border-emerald-200 px-3.5 py-1.5 rounded-xl font-bold text-xs">
                  <Clock className="w-4 h-4 text-emerald-600" />
                  <span>งานค้างส่ง: {memberPendingTasks.length} รายการ</span>
                </span>
              </div>
            </div>
          </div>

          {/* Pending Tasks List (Only unsubmitted tasks, sorted nearest due date first) */}
          <div className="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <h2 className="text-base font-bold text-slate-800">
                  งานที่ Admin มอบหมาย (รอดำเนินการส่งงาน)
                </h2>
                <span className="text-xs font-bold bg-amber-50 text-amber-700 px-2 py-0.5 rounded-md border border-amber-100">
                  {memberPendingTasks.length} งาน
                </span>
              </div>
              <span className="text-[11px] text-slate-400 font-medium">
                * งานที่ส่งแล้วจะถูกซ่อนจากหน้านี้อัตโนมัติ
              </span>
            </div>

            {memberPendingTasks.length === 0 ? (
              <div className="py-12 text-center text-slate-400 space-y-3">
                <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto border border-emerald-200">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <div>
                  <p className="text-base font-bold text-slate-800">ยอดเยี่ยมมาก! คุณไม่มีงานค้างส่งในระบบ</p>
                  <p className="text-xs text-slate-400 mt-1">
                    คุณได้ส่งงานที่ได้รับมอบหมายครบทุกรายการเรียบร้อยแล้ว
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {memberPendingTasks.map((task, idx) => {
                  const isLate = isPastDue(task.dueDate);
                  return (
                    <div
                      key={task.id}
                      className={`p-5 rounded-3xl border transition-all flex flex-col justify-between space-y-4 hover:shadow-md ${
                        isLate
                          ? 'border-rose-200 bg-rose-50/30 hover:border-rose-300'
                          : idx === 0
                          ? 'border-emerald-300 bg-emerald-50/20 hover:border-emerald-400 ring-2 ring-emerald-100'
                          : 'border-slate-200 bg-slate-50/40 hover:border-emerald-300'
                      }`}
                    >
                      <div className="space-y-2">
                        {/* Status & Priority Badge */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center space-x-1.5">
                            {idx === 0 && !isLate && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-600 text-white shadow-2xs">
                                กำหนดส่งใกล้สุด 🔥
                              </span>
                            )}
                            {isLate && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-rose-600 text-white shadow-2xs">
                                เลยกำหนดส่งแล้ว
                              </span>
                            )}
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-100">
                              งานวิชาการ
                            </span>
                          </div>

                          <div className="flex items-center space-x-1 text-xs font-mono font-bold text-slate-700 bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-2xs">
                            <Calendar className="w-3.5 h-3.5 text-purple-600" />
                            <span>กำหนดส่ง: {formatThaiDate(task.dueDate)}</span>
                          </div>
                        </div>

                        {/* Title */}
                        <h3 className="text-base font-bold text-slate-900 leading-snug">
                          {task.title}
                        </h3>

                        {/* Description */}
                        <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed">
                          {task.description || 'ไม่มีคำอธิบายเพิ่มเติมจากผู้ดูแลระบบ'}
                        </p>
                      </div>

                      {/* Footer Info & Instant Submit Button */}
                      <div className="pt-3 border-t border-slate-200/80 flex items-center justify-between gap-2">
                        <div className="text-[11px] text-slate-400">
                          มอบหมายโดย: <span className="font-semibold text-slate-600">{task.assignedBy}</span>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleOpenSubmissionModal(task)}
                          className="btn-glow-emerald px-4 py-2 text-xs sm:text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-all shadow-md inline-flex items-center space-x-1.5 cursor-pointer active:scale-95"
                        >
                          <Send className="w-4 h-4" />
                          <span>กดส่งงานทันที</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Submission Modal Dialog for Member (Popup with multi-file upload) */}
          {activeTaskForSubmission && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
              <div className="bg-white rounded-3xl max-w-2xl w-full p-5 sm:p-7 shadow-2xl border border-slate-100 relative my-8 animate-in fade-in zoom-in duration-200">
                {/* Close Button */}
                <button
                  type="button"
                  onClick={() => setActiveTaskForSubmission(null)}
                  className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                  title="ปิดหน้าต่าง"
                >
                  <X className="w-5 h-5" />
                </button>

                {/* Modal Header */}
                <div className="flex items-start space-x-3.5 pb-4 mb-5 border-b border-slate-100">
                  <div className="w-11 h-11 bg-emerald-600 text-white rounded-2xl flex items-center justify-center shadow-md shrink-0 ring-4 ring-emerald-100">
                    <Send className="w-6 h-6" />
                  </div>
                  <div className="pr-6">
                    <h2 className="text-base sm:text-lg font-bold text-slate-900 leading-tight">
                      ส่งงานวิชาการ: {activeTaskForSubmission.title}
                    </h2>
                    <div className="flex flex-wrap items-center gap-2 text-xs mt-1">
                      <span className="text-slate-500">
                        กำหนดส่ง: <strong className="font-mono text-slate-800">{formatThaiDate(activeTaskForSubmission.dueDate, true)}</strong>
                      </span>
                      {isPastDue(activeTaskForSubmission.dueDate) && (
                        <span className="text-rose-700 bg-rose-100 px-2 py-0.5 rounded-md font-bold text-[11px]">
                          เลยกำหนดส่งแล้ว แต่ระบบยังเปิดให้ส่งงานได้
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Task Details Hint */}
                {activeTaskForSubmission.description && (
                  <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-700 mb-5 leading-relaxed">
                    <p className="font-bold text-slate-800 mb-1">คำชี้แจงจากผู้ดูแลระบบ:</p>
                    <p>{activeTaskForSubmission.description}</p>
                  </div>
                )}

                {/* Submission Form */}
                <form onSubmit={handleSubmitWork} className="space-y-4">
                  {/* Subject Title (Required) */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 block">
                      1. กรอกหัวข้องานที่ส่ง <span className="text-rose-500">* (จำเป็น)</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="เช่น แผนการจัดการเรียนรู้วิชาภาษาไทย ม.2 ภาคเรียนที่ 1/2569"
                      value={submissionSubject}
                      onChange={(e) => setSubmissionSubject(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all outline-hidden font-medium"
                    />
                  </div>

                  {/* Description (Optional) */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                      <span>2. คำอธิบายเพิ่มเติม</span>
                      <span className="text-slate-400 font-normal text-[11px]">(ไม่บังคับ)</span>
                    </label>
                    <textarea
                      rows={2}
                      placeholder="เช่น แนบไฟล์บทเรียน 1-4 พร้อมแบบประเมินผลการเรียนรู้เรียบร้อยครับ"
                      value={submissionDescription}
                      onChange={(e) => setSubmissionDescription(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all outline-hidden"
                    />
                  </div>

                  {/* Multi-File Upload Zone */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-700 flex items-center space-x-1.5">
                        <UploadCloud className="w-4 h-4 text-emerald-600" />
                        <span>3. อัปโหลดไฟล์งาน (รองรับหลายไฟล์พร้อมกัน) <span className="text-rose-500">*</span></span>
                      </label>
                      <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 flex items-center space-x-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                        <span>แนบไฟล์เอกสาร</span>
                      </span>
                    </div>

                    {/* Dropzone */}
                    <div
                      onDragOver={(e) => {
                        e.preventDefault();
                        setDragActive(true);
                      }}
                      onDragLeave={() => setDragActive(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setDragActive(false);
                        handleFilesChosen(e.dataTransfer.files);
                      }}
                      onClick={() => fileInputRef.current?.click()}
                      className={`border-2 border-dashed rounded-2xl p-5 text-center transition-all cursor-pointer ${
                        dragActive
                          ? 'border-emerald-500 bg-emerald-50/50 scale-[1.01]'
                          : 'border-slate-300 hover:border-emerald-400 bg-slate-50/50 hover:bg-slate-50'
                      }`}
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        className="hidden"
                        onChange={(e) => handleFilesChosen(e.target.files)}
                      />

                      <div className="flex flex-col items-center justify-center space-y-1.5">
                        <div className="p-2.5 bg-white rounded-full shadow-xs text-emerald-600">
                          <UploadCloud className="w-6 h-6 animate-pulse" />
                        </div>
                        <p className="text-xs sm:text-sm font-bold text-slate-800">
                          คลิกเพื่อเลือกไฟล์ หรือลากไฟล์มาวางที่นี่
                        </p>
                        <p className="text-[11px] text-slate-500">
                          รองรับทุกนามสกุล: PDF, Word (.docx), Excel (.xlsx), PowerPoint (.pptx), รูปภาพ, ZIP ฯลฯ
                        </p>
                      </div>
                    </div>

                    {/* Loading bar with symbols when uploading */}
                    {isUploading && (
                      <div className="p-3.5 bg-emerald-50/90 rounded-2xl border border-emerald-200/90 flex items-center justify-between shadow-2xs">
                        <div className="flex items-center space-x-3">
                          <div className="relative flex items-center justify-center w-8 h-8 rounded-xl bg-emerald-100 text-emerald-600 shrink-0">
                            <div className="w-5 h-5 border-2 border-emerald-600/30 border-t-emerald-600 rounded-full animate-spin"></div>
                          </div>
                          <div>
                            <p className="text-xs font-bold text-emerald-900">
                              กำลังประมวลผลและแนบไฟล์...
                            </p>
                            <p className="text-[10px] text-emerald-700">
                              ระบบกำลังจัดเตรียมไฟล์งาน กรุณารอสักครู่
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-1.5 pr-1">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce [animation-delay:-0.3s]"></span>
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce [animation-delay:-0.15s]"></span>
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce"></span>
                        </div>
                      </div>
                    )}

                    {/* Uploaded Files List */}
                    {uploadedFiles.length > 0 && (
                      <div className="space-y-2 mt-2">
                        <p className="text-xs font-bold text-slate-700">
                          รายการไฟล์ที่พร้อมส่ง ({uploadedFiles.length} ไฟล์):
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                          {uploadedFiles.map((file) => (
                            <div
                              key={file.id}
                              className="p-2.5 bg-white rounded-xl border border-slate-200 flex items-center justify-between space-x-2 shadow-2xs hover:border-emerald-300 transition-colors"
                            >
                              <div className="flex items-center space-x-2 min-w-0">
                                {file.previewUrl ? (
                                  <img
                                    src={file.previewUrl}
                                    alt="Preview"
                                    className="w-8 h-8 rounded-lg object-cover ring-1 ring-slate-200"
                                  />
                                ) : file.name.endsWith('.pdf') ? (
                                  <div className="p-1.5 bg-rose-50 text-rose-600 rounded-lg">
                                    <FileText className="w-4 h-4" />
                                  </div>
                                ) : file.name.match(/\.(xlsx|xls|csv)$/) ? (
                                  <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
                                    <FileSpreadsheet className="w-4 h-4" />
                                  </div>
                                ) : (
                                  <div className="p-1.5 bg-purple-50 text-purple-600 rounded-lg">
                                    <File className="w-4 h-4" />
                                  </div>
                                )}

                                <div className="min-w-0">
                                  <p className="text-xs font-bold text-slate-800 truncate">
                                    {file.name}
                                  </p>
                                  <p className="text-[10px] text-slate-500 font-mono">
                                    {formatFileSize(file.size)}
                                  </p>
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={() => handleRemoveFile(file.id)}
                                className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                title="ลบไฟล์"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Modal Footer */}
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
                    <button
                      type="button"
                      onClick={() => setActiveTaskForSubmission(null)}
                      className="px-4 py-2.5 text-xs sm:text-sm font-semibold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
                    >
                      ยกเลิก
                    </button>
                    <button
                      type="submit"
                      disabled={isUploading || uploadedFiles.length === 0}
                      className="btn-glow-emerald px-6 py-2.5 text-xs sm:text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-all shadow-md inline-flex items-center space-x-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Send className="w-4 h-4" />
                      <span>ยืนยันและส่งงานวิชาการ</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Member's past submissions history */}
          <div className="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-6 shadow-xs">
            <h2 className="text-base font-bold text-slate-800 mb-3">
              ประวัติผลงานที่คุณส่งแล้ว ({memberCompletedSubmissions.length} รายการ)
            </h2>

            {memberCompletedSubmissions.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">
                คุณยังไม่มีประวัติการส่งงานในระบบ
              </p>
            ) : (
              <div className="space-y-3">
                {memberCompletedSubmissions.map((sub) => {
                  let formattedDate = '-';
                  try {
                    if (sub.submittedAt) {
                      formattedDate = new Date(sub.submittedAt).toLocaleString('th-TH');
                    }
                  } catch {
                    formattedDate = sub.submittedAt || '-';
                  }

                  const fileCount = Array.isArray(sub.files) ? sub.files.length : 0;

                  return (
                    <div
                      key={sub.id}
                      className="p-4 rounded-2xl border border-slate-200/80 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-emerald-100 text-emerald-800 border-emerald-300">
                            ✓ ส่งงานเรียบร้อยแล้ว
                          </span>
                          <span className="text-xs text-slate-500">
                            ส่งเมื่อ: {formattedDate}
                          </span>
                        </div>
                        <p className="text-sm font-bold text-slate-900">{sub.subject || '-'}</p>
                        <p className="text-xs text-purple-700 font-medium">{sub.taskTitle || '-'}</p>
                      </div>

                      <div className="flex items-center space-x-2">
                        <span className="text-xs text-slate-600 bg-white px-2.5 py-1 rounded-lg border border-slate-200">
                          {fileCount} ไฟล์แนบ
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

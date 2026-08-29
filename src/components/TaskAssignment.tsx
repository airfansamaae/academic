import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Plus,
  Megaphone,
  Calendar,
  UploadCloud,
  FileText,
  FileSpreadsheet,
  File,
  Trash2,
  CheckCircle2,
  Clock,
  HardDrive,
  Edit3,
  Check,
  X,
  FolderOpen,
  Eye,
  ExternalLink,
  Paperclip,
  Users,
  Search,
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
  GDRIVE_FOLDER_ID,
} from '../services/storage';
import {
  uploadFileToGoogleDrive,
  createGoogleDriveFolder,
  deleteGoogleDriveFile,
  extractDriveFileId,
  isProtectedRootFolder,
} from '../services/driveUpload';
import {
  notifySuccess,
  notifyError,
  notifyWarning,
  notifyInfo,
  confirmDialog,
} from '../services/notifications';
import { ThaiDatePicker } from './ThaiDatePicker';
import {
  formatThaiDate,
  formatThaiDateRange,
  isRangePastDue,
  getDatesInRange,
} from '../utils/dateHelpers';

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

  // Safe data arrays
  const safeTasks = Array.isArray(tasks) ? tasks : [];
  const safeAnnouncements = Array.isArray(announcements) ? announcements : [];
  const safeSubmissions = Array.isArray(submissions) ? submissions : [];

  // Helper sort: Nearest due date first (ascending)
  const sortByDueDateAsc = (a: { dueDate?: string }, b: { dueDate?: string }) => {
    const dateA = a?.dueDate || '9999-99-99';
    const dateB = b?.dueDate || '9999-99-99';
    return dateA.localeCompare(dateB);
  };

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
  const [modalEndDate, setModalEndDate] = useState<string>('');
  const [modalAnnType, setModalAnnType] = useState<AnnouncementType>('ACTIVITY');
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Admin List Filter Tab
  const [adminListFilter, setAdminListFilter] = useState<'ALL' | 'TASK' | 'ANNOUNCEMENT'>('ALL');

  // Sorted Tasks for Admin (nearest due date first)
  const adminSortedTasks = [...safeTasks].sort(sortByDueDateAsc);

  // Sorted Announcements for Admin
  const adminSortedAnnouncements = [...safeAnnouncements].sort((a, b) => {
    const dateA = a?.date || '9999-99-99';
    const dateB = b?.date || '9999-99-99';
    return dateA.localeCompare(dateB);
  });

  // Member Task Separation:
  // 1. Pending (ยังไม่ส่งงาน) - อยู่ข้างบน เรียงตามกำหนดส่งที่ใกล้จะถึงก่อน
  const memberPendingTasks = safeTasks
    .filter((task) => {
      if (!task || !task.id) return false;
      if (!currentUser) return true;
      return !safeSubmissions.some(
        (s) => s && s.taskId === task.id && s.memberId === currentUser.id
      );
    })
    .sort(sortByDueDateAsc);

  // 2. Submitted (ส่งงานแล้ว) - ย้ายไปอยู่ข้างล่างสุด
  const memberSubmittedTasksWithSubmissions = safeTasks
    .map((task) => {
      const submission = safeSubmissions.find(
        (s) => s && s.taskId === task.id && s.memberId === currentUser?.id
      );
      return { task, submission };
    })
    .filter((item): item is { task: Task; submission: Submission } => Boolean(item.submission))
    .sort((a, b) => sortByDueDateAsc(a.task, b.task));

  // Member Submission Modal State
  const [activeTaskForSubmission, setActiveTaskForSubmission] = useState<Task | null>(null);
  const [editingSubmission, setEditingSubmission] = useState<Submission | null>(null);
  const [submissionSubject, setSubmissionSubject] = useState('');
  const [submissionDescription, setSubmissionDescription] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState<SubmissionFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  // Peer Submissions Viewer Modal State (สำหรับสมาชิกและแอดมินดูผลงานที่เพื่อนส่ง)
  const [viewingTaskSubmissions, setViewingTaskSubmissions] = useState<Task | null>(null);
  const [peerSearchTerm, setPeerSearchTerm] = useState('');

  // Preview File Viewer Modal State (สำหรับกดไอคอนตา 👁️ เพื่อเปิดดูไฟล์เท่านั้น ไม่มีการดาวน์โหลด)
  const [previewModalFile, setPreviewModalFile] = useState<{
    file: SubmissionFile;
    sub?: Partial<Submission>;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Open file preview modal
  const handleOpenFilePreview = (file: SubmissionFile, sub?: Partial<Submission>) => {
    setPreviewModalFile({ file, sub });
  };

  // Open modal to submit new task
  const handleOpenSubmissionModal = (task: Task) => {
    if (!task) return;
    setEditingSubmission(null);
    setActiveTaskForSubmission(task);
    setSubmissionSubject(task.title || '');
    setSubmissionDescription('');
    setUploadedFiles([]);
  };

  // Open modal to edit existing submission
  const handleOpenEditSubmissionModal = (task: Task, submission: Submission) => {
    if (!task || !submission) return;
    setEditingSubmission(submission);
    setActiveTaskForSubmission(task);
    setSubmissionSubject(submission.subject || task.title || '');
    setSubmissionDescription(submission.description || '');
    setUploadedFiles(Array.isArray(submission.files) ? [...submission.files] : []);
  };

  useEffect(() => {
    if (preSelectedTask && !isAdmin) {
      const existingSub = safeSubmissions.find(
        (s) => s && s.taskId === preSelectedTask.id && s.memberId === currentUser?.id
      );
      if (existingSub) {
        handleOpenEditSubmissionModal(preSelectedTask, existingSub);
      } else {
        handleOpenSubmissionModal(preSelectedTask);
      }
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

  // Open modal for new creation (Admin)
  const handleOpenCreateModal = (category: 'TASK' | 'ANNOUNCEMENT' = 'TASK') => {
    setEditingItemId(null);
    setModalCategory(category);
    setModalTitle('');
    setModalDescription('');
    const d = new Date();
    const todayStr = d.toISOString().split('T')[0];
    if (category === 'TASK') {
      d.setDate(d.getDate() + 7);
      const endStr = d.toISOString().split('T')[0];
      setModalDate(todayStr);
      setModalEndDate(endStr);
    } else {
      setModalDate(todayStr);
      setModalEndDate(todayStr);
    }
    setModalAnnType('ACTIVITY');
    setIsModalOpen(true);
  };

  // Open modal for editing a task (Admin)
  const handleOpenEditTask = (task: Task) => {
    setEditingItemId(task.id);
    setModalCategory('TASK');
    setModalTitle(task.title);
    setModalDescription(task.description || '');
    setModalDate(task.startDate || task.dueDate);
    setModalEndDate(task.dueDate);
    setIsModalOpen(true);
  };

  // Open modal for editing an announcement (Admin)
  const handleOpenEditAnnouncement = (ann: Announcement) => {
    setEditingItemId(ann.id);
    setModalCategory('ANNOUNCEMENT');
    setModalTitle(ann.title);
    setModalDescription(ann.details || '');
    setModalDate(ann.date);
    setModalEndDate(ann.endDate || ann.date);
    setModalAnnType(ann.type);
    setIsModalOpen(true);
  };

  // Save Modal Form (Admin: Handles both Task & Announcement)
  const handleSaveModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalTitle.trim() || !modalDate) {
      notifyError('กรุณากรอกหัวข้อและกำหนดวันที่ให้ครบถ้วน');
      return;
    }

    const title = modalTitle.trim();
    const desc = modalDescription.trim();
    const startDate = modalDate;
    const endDate = modalEndDate && modalEndDate >= modalDate ? modalEndDate : modalDate;
    const assignedBy = currentUser?.fullName || 'ผู้ดูแลระบบวิชาการ';

    try {
      if (modalCategory === 'TASK') {
        if (editingItemId) {
          const existing = tasks.find((t) => t.id === editingItemId);
          if (existing) {
            StorageService.updateTask({
              ...existing,
              title,
              category: 'งานวิชาการ',
              description: desc,
              startDate: startDate !== endDate ? startDate : undefined,
              dueDate: endDate,
            });
            notifySuccess('บันทึกการแก้ไขสำเร็จ');
          }
        } else {
          // Instant Task Creation (<1ms response time)
          const newTask = StorageService.createTask({
            title,
            category: 'งานวิชาการ',
            description: desc,
            startDate: startDate !== endDate ? startDate : undefined,
            dueDate: endDate,
            assignedBy,
          });

          notifySuccess('มอบหมายงานสำเร็จ');

          // Asynchronously create folder in background without blocking UI
          createGoogleDriveFolder(title)
            .then((folderRes) => {
              if (folderRes && folderRes.success && folderRes.folderId && !folderRes.folderId.startsWith('task_folder_')) {
                StorageService.updateTask({
                  ...newTask,
                  gDriveFolderId: folderRes.folderId,
                  gDriveFolderUrl: folderRes.folderUrl,
                });
              }
            })
            .catch(() => {});
        }
      } else {
        if (editingItemId) {
          const existing = announcements.find((a) => a.id === editingItemId);
          if (existing) {
            StorageService.updateAnnouncement({
              ...existing,
              title,
              details: desc,
              date: startDate,
              endDate: startDate !== endDate ? endDate : undefined,
              type: modalAnnType,
            });
            notifySuccess('บันทึกการแก้ไขสำเร็จ');
          }
        } else {
          StorageService.createAnnouncement({
            title,
            details: desc,
            date: startDate,
            endDate: startDate !== endDate ? endDate : undefined,
            type: modalAnnType,
            createdBy: assignedBy,
          });
          notifySuccess('สร้างประกาศสำเร็จ');
        }
      }

      setIsModalOpen(false);
      onRefreshData();
    } catch (err) {
      console.error('Save error:', err);
      notifyError('เกิดข้อผิดพลาดในการบันทึกข้อมูล');
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    const taskToDelete = tasks.find((t) => t.id === taskId);
    const ok = await confirmDialog(
      'ยืนยันการลบงานนี้?',
      `การลบงาน "${taskToDelete?.title || ''}" จะนำภาระงานและรายการส่งงานทั้งหมดออกจากระบบ`
    );
    if (ok) {
      StorageService.deleteTask(taskId);
      notifySuccess('ลบงานมอบหมายสำเร็จ');
      onRefreshData();
    }
  };

  const handleDeleteAllTasks = async () => {
    if (adminSortedTasks.length === 0) return;
    const ok = await confirmDialog(
      '⚠️ ยืนยันการลบงานทั้งหมด?',
      'งานมอบหมายทั้งหมด รวมถึงข้อมูลการส่งงานของสมาชิกจะถูกลบออกจากระบบอย่างถาวร'
    );
    if (ok) {
      StorageService.deleteAllTasks();
      notifySuccess('ลบงานมอบหมายทั้งหมดสำเร็จ');
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

  // --- Member Multi-file Upload ---
  const handleFilesChosen = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setIsUploading(true);
    const fileList = Array.from(files);
    const targetFolderId = activeTaskForSubmission?.gDriveFolderId || GDRIVE_FOLDER_ID;

    try {
      const uploadPromises = fileList.map(async (file, i) => {
        try {
          const result = await uploadFileToGoogleDrive(file, targetFolderId);
          return {
            id: `file-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 7)}`,
            name: file.name,
            size: file.size,
            type: file.type || 'application/octet-stream',
            gDriveUrl: result.fileUrl || (result.fileId ? `https://drive.google.com/file/d/${result.fileId}/view?usp=sharing` : `https://drive.google.com/drive/folders/${targetFolderId}`),
            gDriveFileId: result.fileId,
            targetFolderId: targetFolderId,
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
            gDriveUrl: `https://drive.google.com/drive/folders/${targetFolderId}`,
            targetFolderId: targetFolderId,
            uploadedAt: new Date().toISOString(),
          } as SubmissionFile;
        }
      });

      const uploadedResults = await Promise.all(uploadPromises);
      setUploadedFiles((prev) => [...prev, ...uploadedResults]);
      notifySuccess(`แนบ ${uploadedResults.length} ไฟล์สำเร็จ`);
    } catch (err) {
      console.error('Parallel upload error:', err);
      notifyError('เกิดข้อผิดพลาดในการแนบไฟล์');
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveFile = (fileId: string) => {
    const fileToRemove = uploadedFiles.find((f) => f.id === fileId);
    if (fileToRemove) {
      const targetFolderId = activeTaskForSubmission?.gDriveFolderId || GDRIVE_FOLDER_ID;
      deleteGoogleDriveFile(fileToRemove.gDriveFileId || fileToRemove.gDriveUrl || fileToRemove.id, fileToRemove.name, targetFolderId).catch(() => {});
    }
    setUploadedFiles((prev) => prev.filter((f) => f.id !== fileId));
    notifyInfo('ลบไฟล์เรียบร้อยแล้ว');
  };

  const handleDeleteMemberSubmission = async (submission: Submission) => {
    const ok = await confirmDialog(
      'ยืนยันการลบผลงานนี้?',
      'รายการส่งงานและไฟล์ทั้งหมดใน Google Drive จะถูกลบออกอัตโนมัติ'
    );
    if (ok) {
      // Auto delete files from Google Drive
      if (Array.isArray(submission.files)) {
        const relatedTask = tasks.find((t) => t.id === submission.taskId);
        const targetFolderId = relatedTask?.gDriveFolderId || GDRIVE_FOLDER_ID;
        submission.files.forEach((f) => {
          deleteGoogleDriveFile(f.gDriveFileId || f.gDriveUrl || f.id, f.name, targetFolderId).catch(() => {});
        });
      }
      StorageService.deleteSubmission(submission.id);
      notifySuccess('ลบรายการส่งงานและไฟล์ใน Google Drive สำเร็จ');
      if (activeTaskForSubmission) {
        setActiveTaskForSubmission(null);
        setEditingSubmission(null);
      }
      onRefreshData();
    }
  };

  // --- Member Submit or Update Task ---
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

    if (editingSubmission) {
      // Update existing submission
      StorageService.updateSubmission({
        ...editingSubmission,
        subject: submissionSubject.trim(),
        description: submissionDescription.trim(),
        files: uploadedFiles,
      });
      notifySuccess('บันทึกการส่งงานสำเร็จ');
    } else {
      // Create new submission
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

      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
      });

      notifySuccess('ส่งงานสำเร็จ');
    }

    setActiveTaskForSubmission(null);
    setEditingSubmission(null);
    onRefreshData();
  };

  return (
    <div className="space-y-6">
      {/* ========================================================================= */}
      {/* ============================== ADMIN VIEW =============================== */}
      {/* ========================================================================= */}
      {isAdmin && (
        <div className="space-y-6">
          {/* Admin Top Header: Title & Actions */}
          <div className="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center space-x-3.5">
              <div className="w-12 h-12 bg-purple-600 text-white rounded-2xl flex items-center justify-center shadow-md shrink-0 ring-4 ring-purple-100">
                <Send className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-lg sm:text-xl font-bold text-slate-800 tracking-tight">
                  มอบหมายงาน & ประกาศ
                </h1>
                <p className="text-xs sm:text-sm text-slate-500">
                  ผู้ดูแลระบบมอบหมายงานวิชาการและประกาศแจ้งเพื่อทราบ (งานเรียงตามกำหนดส่งที่ใกล้ที่สุด)
                </p>
              </div>
            </div>

            {/* Admin Actions */}
            <div className="flex items-center flex-wrap gap-2.5">
              {/* Admin Create Button */}
              <button
                type="button"
                onClick={() => handleOpenCreateModal('TASK')}
                className="btn-glow-purple px-4 sm:px-5 py-2.5 text-xs sm:text-sm font-bold text-white bg-purple-600 hover:bg-purple-700 active:scale-95 transition-all rounded-xl shadow-md inline-flex items-center space-x-2 cursor-pointer"
              >
                <Plus className="w-4 h-4 text-white" />
                <span>มอบหมายงาน / ประกาศใหม่</span>
              </button>
            </div>
          </div>

          {/* Filter Categories Tab */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center space-x-1.5 bg-slate-100/80 p-1 rounded-2xl border border-slate-200">
              <button
                type="button"
                onClick={() => setAdminListFilter('ALL')}
                className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                  adminListFilter === 'ALL'
                    ? 'bg-white text-purple-900 shadow-2xs'
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
                <span>📝 มอบหมายงาน</span>
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

            <div className="flex items-center space-x-3 text-xs text-slate-500">
              <span className="inline-flex items-center space-x-1">
                <span className="w-2.5 h-2.5 rounded-full bg-purple-600"></span>
                <span>งานมอบหมาย: สีม่วง</span>
              </span>
              <span className="inline-flex items-center space-x-1">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                <span>ประกาศ: สีส้ม</span>
              </span>
              <span className="inline-flex items-center space-x-1">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-600"></span>
                <span>ส่งงานแล้ว: สีเขียว</span>
              </span>
            </div>
          </div>

          {/* Assigned Tasks Section (Admin) */}
          {(adminListFilter === 'ALL' || adminListFilter === 'TASK') && (
            <div className="bg-white rounded-2xl border border-purple-100 p-4 sm:p-5 shadow-xs space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-purple-100/70">
                <div className="flex items-center space-x-2">
                  <span className="text-sm sm:text-base font-bold text-slate-800">
                    รายการงานที่มอบหมาย (เรียงตามกำหนดส่งใกล้ที่สุดอยู่บน)
                  </span>
                  <span className="text-xs font-bold bg-purple-50 text-purple-700 px-2 py-0.5 rounded-md border border-purple-100">
                    {adminSortedTasks.length} รายการ
                  </span>
                </div>
                {adminSortedTasks.length > 0 && (
                  <button
                    type="button"
                    onClick={handleDeleteAllTasks}
                    className="px-2.5 py-1 text-xs font-bold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-all flex items-center space-x-1 cursor-pointer shadow-2xs"
                    title="ลบงานมอบหมายทั้งหมดออกจากระบบ"
                  >
                    <Trash2 className="w-3 h-3 text-red-500" />
                    <span>ลบงานทั้งหมด ({adminSortedTasks.length})</span>
                  </button>
                )}
              </div>

              {adminSortedTasks.length === 0 ? (
                <div className="py-6 text-center text-slate-400 text-xs">
                  ยังไม่มีรายการงานที่มอบหมาย กดปุ่มด้านบนเพื่อสร้างงานใหม่
                </div>
              ) : (
                /* --- Admin Compact List (Table) View --- */
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-purple-100 bg-purple-50/60 text-purple-900">
                        <th className="py-2.5 px-3 rounded-l-lg font-bold">หมวดหมู่ & หัวข้องาน</th>
                        <th className="py-2.5 px-3 font-bold">กำหนดส่ง (DD/MM/YYYY)</th>
                        <th className="py-2.5 px-3 font-bold">Google Drive</th>
                        <th className="py-2.5 px-3 font-bold">สถานะการส่งงาน (สีเขียว)</th>
                        <th className="py-2.5 px-3 rounded-r-lg font-bold text-right">การจัดการ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {adminSortedTasks.map((task, idx) => {
                        const taskSubmissions = safeSubmissions.filter((s) => s && s.taskId === task.id);
                        return (
                          <tr key={task.id} className="hover:bg-purple-50/30 transition-colors">
                            <td className="py-2.5 px-3">
                              <div className="flex items-center space-x-2">
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-purple-100 text-purple-800 border border-purple-200 whitespace-nowrap">
                                  งานมอบหมาย
                                </span>
                                {idx === 0 && (
                                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-600 text-white whitespace-nowrap">
                                    ใกล้สุด
                                  </span>
                                )}
                                <p className="font-bold text-slate-800 line-clamp-1">{task.title}</p>
                              </div>
                              {task.description && (
                                <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5 pl-0.5">
                                  {task.description}
                                </p>
                              )}
                            </td>
                            <td className="py-2.5 px-3 whitespace-nowrap font-mono font-semibold text-slate-800">
                              {formatThaiDateRange(task.startDate || task.dueDate, task.dueDate)}
                            </td>
                            <td className="py-2.5 px-3 whitespace-nowrap">
                              {task.gDriveFolderUrl ? (
                                <a
                                  href={task.gDriveFolderUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded-md transition-colors inline-flex items-center space-x-1"
                                  title="เปิดโฟลเดอร์งานนี้ใน Google Drive"
                                >
                                  <HardDrive className="w-3.5 h-3.5 text-emerald-600" />
                                  <span>เปิดโฟลเดอร์</span>
                                </a>
                              ) : (
                                <span className="text-slate-400">-</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => {
                                  setViewingTaskSubmissions(task);
                                  setPeerSearchTerm('');
                                }}
                                className="inline-flex items-center space-x-1.5 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-full border border-emerald-200 transition-all cursor-pointer shadow-2xs hover:scale-[1.02]"
                                title="คลิกเพื่อเปิดดูไฟล์งานที่สมาชิกส่ง"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                <span>ส่งแล้ว {taskSubmissions.length} คน</span>
                                <Eye className="w-3.5 h-3.5 text-emerald-700 ml-0.5" />
                              </button>
                            </td>
                            <td className="py-2.5 px-3 text-right whitespace-nowrap">
                              <div className="inline-flex items-center space-x-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setViewingTaskSubmissions(task);
                                    setPeerSearchTerm('');
                                  }}
                                  className="px-2 py-1 text-slate-600 hover:text-purple-700 hover:bg-purple-50 rounded-lg transition-colors cursor-pointer inline-flex items-center space-x-1 border border-slate-200"
                                  title="ดูผลงานสมาชิกที่ส่ง"
                                >
                                  <Users className="w-3.5 h-3.5 text-purple-600" />
                                  <span className="text-[11px] font-semibold">ดูงานที่ส่ง</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditTask(task)}
                                  className="p-1 text-slate-500 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors cursor-pointer"
                                  title="แก้ไขงาน"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteTask(task.id)}
                                  className="p-1 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                  title="ลบงาน"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
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

          {/* Announcements Section (Admin) */}
          {(adminListFilter === 'ALL' || adminListFilter === 'ANNOUNCEMENT') && (
            <div className="bg-white rounded-2xl border border-amber-200/80 p-4 sm:p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between pb-2.5 border-b border-amber-100">
                <div className="flex items-center space-x-2">
                  <span className="text-sm sm:text-base font-bold text-slate-800 flex items-center space-x-1.5">
                    <span>📢</span>
                    <span>รายการประกาศแจ้งเพื่อทราบทั้งหมด</span>
                  </span>
                  <span className="text-xs font-bold bg-amber-50 text-amber-800 px-2 py-0.5 rounded-md border border-amber-200">
                    {adminSortedAnnouncements.length} รายการ
                  </span>
                </div>
              </div>

              {adminSortedAnnouncements.length === 0 ? (
                <div className="py-6 text-center text-slate-400 text-xs">
                  ยังไม่มีประกาศแจ้งเพื่อทราบ กดปุ่มด้านบนเพื่อสร้างประกาศใหม่
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-amber-200 bg-amber-50/70 text-amber-950">
                        <th className="py-2.5 px-3 rounded-l-lg font-bold">ประเภท & หัวข้อประกาศ</th>
                        <th className="py-2.5 px-3 font-bold">วันที่ประกาศ / จัดกิจกรรม</th>
                        <th className="py-2.5 px-3 font-bold">รายละเอียด</th>
                        <th className="py-2.5 px-3 rounded-r-lg font-bold text-right">การจัดการ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {adminSortedAnnouncements.map((ann) => (
                        <tr key={ann.id} className="hover:bg-amber-50/30 transition-colors">
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-200">
                              {ann.type === 'HOLIDAY'
                                ? '🏖️ วันหยุด'
                                : ann.type === 'ACTIVITY'
                                ? '🎯 กิจกรรม'
                                : '📢 ข่าวสาร'}
                            </span>
                            <span className="ml-2 font-bold text-slate-800">{ann.title}</span>
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap font-mono font-semibold text-slate-700">
                            {formatThaiDateRange(ann.date, ann.endDate || ann.date)}
                          </td>
                          <td className="py-2.5 px-3 text-slate-600 max-w-xs truncate">
                            {ann.details || '-'}
                          </td>
                          <td className="py-2.5 px-3 text-right whitespace-nowrap">
                            <div className="inline-flex items-center space-x-1">
                              <button
                                type="button"
                                onClick={() => handleOpenEditAnnouncement(ann)}
                                className="p-1 text-slate-400 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                                title="แก้ไขประกาศ"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteAnnouncement(ann.id)}
                                className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                title="ลบประกาศ"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ================= ADMIN CREATE / EDIT MODAL ================= */}
          {isModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
              <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto space-y-5 animate-in zoom-in-95 duration-150">
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

                <form onSubmit={handleSaveModal} className="space-y-4">
                  {!editingItemId && (
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700 block">
                        1. เลือกหมวดหมู่ <span className="text-rose-500">*</span>
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
                            <p className="text-xs font-bold leading-tight">มอบหมายงาน (สีม่วง)</p>
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
                            <p className="text-xs font-bold leading-tight">ประกาศแจ้งเพื่อทราบ</p>
                            <p className="text-[10px] text-slate-500">ปฏิทิน & ข่าวสาร</p>
                          </div>
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 block">
                      {editingItemId ? '1.' : '2.'}{' '}
                      {modalCategory === 'TASK' ? 'หัวข้องานวิชาการ' : 'หัวข้อประกาศ'}{' '}
                      <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder={
                        modalCategory === 'TASK'
                          ? 'เช่น ส่งแผนการจัดการเรียนรู้ ภาคเรียนที่ 1/2569'
                          : 'เช่น ประชุมคณะกรรมการวิชาการประจำเดือน'
                      }
                      value={modalTitle}
                      onChange={(e) => setModalTitle(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all outline-hidden font-medium"
                    />
                  </div>

                  {modalCategory === 'ANNOUNCEMENT' && (
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700 block">
                        ประเภทของประกาศ <span className="text-rose-500">*</span>
                      </label>
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

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                      <span>3. รายละเอียดคำอธิบาย</span>
                      <span className="text-slate-400 font-normal text-[11px]">(ไม่บังคับ)</span>
                    </label>
                    <textarea
                      rows={3}
                      placeholder="ระบุรูปแบบเอกสาร ไฟล์ที่ต้องการ หรือเงื่อนไขการส่งงาน..."
                      value={modalDescription}
                      onChange={(e) => setModalDescription(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all outline-hidden"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <ThaiDatePicker
                      value={modalDate}
                      endDate={modalEndDate}
                      onChange={(val) => {
                        setModalDate(val);
                        setModalEndDate(val);
                      }}
                      onChangeRange={(start, end) => {
                        setModalDate(start);
                        setModalEndDate(end);
                      }}
                      allowRange={true}
                      label={`4. ${
                        modalCategory === 'TASK'
                          ? 'กำหนดวันส่งงาน / กำหนดส่งแบบช่วงวันที่ (dd/mm/yyyy)'
                          : 'วันที่เกิดกิจกรรม / ช่วงเวลาจัดกิจกรรม (dd/mm/yyyy)'
                      }`}
                      required
                      colorScheme={modalCategory === 'TASK' ? 'purple' : 'amber'}
                    />
                  </div>

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

      {/* ========================================================================= */}
      {/* ============================= MEMBER VIEW =============================== */}
      {/* ========================================================================= */}
      {!isAdmin && (
        <div className="space-y-6">
          {/* Member Top Header */}
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
                  งานที่ยังไม่ส่ง (สีม่วง) อยู่ข้างบนเรียงตามกำหนดส่ง • งานที่ส่งแล้ว (สีเขียว) อยู่ข้างล่างสุด
                </p>
              </div>
            </div>

            {/* Stat Badges */}
            <div className="flex items-center flex-wrap gap-2">
              <span className="inline-flex items-center space-x-1.5 bg-purple-50 text-purple-800 border border-purple-200 px-3 py-1.5 rounded-xl font-bold text-xs">
                <Clock className="w-3.5 h-3.5 text-purple-600" />
                <span>ยังไม่ส่ง: {memberPendingTasks.length}</span>
              </span>
              <span className="inline-flex items-center space-x-1.5 bg-emerald-50 text-emerald-800 border border-emerald-200 px-3 py-1.5 rounded-xl font-bold text-xs">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>ส่งแล้ว: {memberSubmittedTasksWithSubmissions.length}</span>
              </span>
            </div>
          </div>

          {/* ================= TOP SECTION: PENDING TASKS (ยังไม่ส่งงาน : สีม่วง) ================= */}
          <div className="bg-white rounded-2xl border border-purple-200 p-4 sm:p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-2.5 border-b border-purple-100">
              <div className="flex items-center space-x-2">
                <div className="w-2.5 h-2.5 rounded-full bg-purple-600 ring-4 ring-purple-100"></div>
                <h2 className="text-sm sm:text-base font-bold text-purple-950">
                  งานที่ยังไม่ส่ง (ยังไม่ส่งงาน : สีม่วง) — เรียงตามกำหนดส่งใกล้ที่สุดอยู่บน
                </h2>
                <span className="text-xs font-bold bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full border border-purple-200">
                  {memberPendingTasks.length} รายการ
                </span>
              </div>
              <span className="text-xs font-medium text-purple-700 bg-purple-50 px-2.5 py-0.5 rounded-lg border border-purple-100 hidden sm:inline-block">
                🔔 กรุณาส่งงานก่อนเลยกำหนด
              </span>
            </div>

            {memberPendingTasks.length === 0 ? (
              <div className="py-6 text-center text-slate-400 space-y-1.5">
                <div className="w-10 h-10 bg-purple-50 text-purple-600 rounded-full flex items-center justify-center mx-auto border border-purple-200">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <p className="text-sm font-bold text-slate-700">ไม่มีงานค้างส่งในส่วนนี้</p>
                <p className="text-xs text-slate-400">คุณได้ส่งงานทุกรายการครบถ้วนแล้ว ดูรายการด้านล่าง</p>
              </div>
            ) : (
              /* --- Member Pending Tasks: Compact LIST VIEW --- */
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-purple-100 bg-purple-50/70 text-purple-900">
                      <th className="py-2.5 px-3 rounded-l-lg font-bold">สถานะ & หัวข้องาน</th>
                      <th className="py-2.5 px-3 font-bold">กำหนดส่ง (DD/MM/YYYY)</th>
                      <th className="py-2.5 px-3 font-bold">งานที่เพื่อนส่ง</th>
                      <th className="py-2.5 px-3 rounded-r-lg font-bold text-right">ดำเนินการ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-purple-50">
                    {memberPendingTasks.map((task, idx) => {
                      const isLate = isPastDue(task.dueDate);
                      const taskSubmissions = safeSubmissions.filter((s) => s && s.taskId === task.id);
                      return (
                        <tr key={task.id} className="hover:bg-purple-50/30 transition-colors">
                          <td className="py-2.5 px-3">
                            <div className="flex items-center space-x-2">
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-purple-100 text-purple-800 border border-purple-200 whitespace-nowrap">
                                🟣 ยังไม่ส่ง
                              </span>
                              {idx === 0 && !isLate && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-600 text-white whitespace-nowrap">
                                  ใกล้สุด
                                </span>
                              )}
                              {isLate && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-600 text-white whitespace-nowrap">
                                  เลยกำหนด
                                </span>
                              )}
                              <p className="font-bold text-slate-800">{task.title}</p>
                            </div>
                            {task.description && (
                              <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5 pl-0.5">
                                {task.description}
                              </p>
                            )}
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap font-mono font-semibold text-purple-900">
                            {formatThaiDateRange(task.startDate || task.dueDate, task.dueDate)}
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            {taskSubmissions.length > 0 ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setViewingTaskSubmissions(task);
                                  setPeerSearchTerm('');
                                }}
                                className="inline-flex items-center space-x-1 text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 px-2.5 py-1 rounded-full border border-purple-200 transition-all cursor-pointer shadow-2xs hover:scale-[1.02]"
                                title="คลิกเพื่อดูไฟล์ผลงานของเพื่อนสมาชิก"
                              >
                                <Users className="w-3.5 h-3.5 text-purple-600" />
                                <span>เพื่อนส่งแล้ว {taskSubmissions.length} คน</span>
                                <Eye className="w-3.5 h-3.5 text-purple-600 ml-0.5" />
                              </button>
                            ) : (
                              <span className="text-slate-400 text-[11px] italic">ยังไม่มีใครส่ง</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right whitespace-nowrap">
                            <div className="inline-flex items-center space-x-1.5">
                              {taskSubmissions.length > 0 && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setViewingTaskSubmissions(task);
                                    setPeerSearchTerm('');
                                  }}
                                  className="px-2.5 py-1.5 text-xs font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg transition-all inline-flex items-center space-x-1 cursor-pointer"
                                  title="ดูผลงานของเพื่อนร่วมงาน"
                                >
                                  <Eye className="w-3.5 h-3.5 text-purple-600" />
                                  <span>ดูเพื่อนส่ง ({taskSubmissions.length})</span>
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleOpenSubmissionModal(task)}
                                className="px-3 py-1.5 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition-all shadow-xs inline-flex items-center space-x-1.5 cursor-pointer"
                              >
                                <Send className="w-3.5 h-3.5" />
                                <span>ส่งงาน</span>
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

          {/* ================= BOTTOM SECTION: SUBMITTED TASKS (ส่งงานแล้ว : สีเขียว) ================= */}
          <div className="bg-white rounded-2xl border border-emerald-200 p-4 sm:p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-2.5 border-b border-emerald-100">
              <div className="flex items-center space-x-2">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-600 ring-4 ring-emerald-100"></div>
                <h2 className="text-sm sm:text-base font-bold text-emerald-950">
                  งานที่ส่งแล้ว (ส่งงานแล้ว : สีเขียว) — ย้ายมาอยู่ล่างสุด (แก้ไขเปลี่ยนชื่อและแนบไฟล์ใหม่ได้)
                </h2>
                <span className="text-xs font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-200">
                  {memberSubmittedTasksWithSubmissions.length} รายการ
                </span>
              </div>
              <span className="text-xs font-medium text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-lg border border-emerald-100 hidden sm:inline-block">
                ✨ กดไอคอน 👁️ เพื่อเปิดดูไฟล์งาน หรือคลิก "ดูเพื่อนส่ง"
              </span>
            </div>

            {memberSubmittedTasksWithSubmissions.length === 0 ? (
              <div className="py-6 text-center text-slate-400 space-y-1.5">
                <p className="text-sm font-bold text-slate-700">ยังไม่มีรายการงานที่ส่งแล้ว</p>
                <p className="text-xs text-slate-400">เมื่อคุณส่งงาน รายการจะถูกย้ายมาแสดงที่ส่วนนี้โดยอัตโนมัติ</p>
              </div>
            ) : (
              /* --- Member Submitted Tasks: Compact LIST VIEW --- */
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-emerald-100 bg-emerald-50/70 text-emerald-900">
                      <th className="py-2.5 px-3 rounded-l-lg font-bold">สถานะ & ชื่องานที่ส่ง</th>
                      <th className="py-2.5 px-3 font-bold">ชื่องานมอบหมายเดิม</th>
                      <th className="py-2.5 px-3 font-bold">กำหนดส่ง</th>
                      <th className="py-2.5 px-3 font-bold">ไฟล์ที่แนบ (คลิก 👁️ เพื่อเปิดดู)</th>
                      <th className="py-2.5 px-3 rounded-r-lg font-bold text-right">การจัดการ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-emerald-50">
                    {memberSubmittedTasksWithSubmissions.map(({ task, submission }) => {
                      const files = Array.isArray(submission.files) ? submission.files : [];
                      const fileCount = files.length;
                      const allTaskSubmissions = safeSubmissions.filter((s) => s && s.taskId === task.id);
                      return (
                        <tr key={task.id} className="hover:bg-emerald-50/30 transition-colors">
                          <td className="py-2.5 px-3">
                            <div className="flex items-center space-x-2">
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-300 whitespace-nowrap">
                                🟢 ส่งแล้ว
                              </span>
                              <p className="font-bold text-slate-800">{submission.subject || task.title}</p>
                            </div>
                            {submission.description && (
                              <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5 pl-0.5">
                                {submission.description}
                              </p>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">
                            {task.title}
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap font-mono font-semibold text-emerald-900">
                            {formatThaiDateRange(task.startDate || task.dueDate, task.dueDate)}
                          </td>
                          <td className="py-2.5 px-3">
                            {fileCount === 0 ? (
                              <span className="text-slate-400 text-xs italic">ไม่มีไฟล์แนบ</span>
                            ) : (
                              <div className="flex flex-wrap items-center gap-1.5 max-w-xs sm:max-w-md">
                                {files.map((file) => (
                                  <button
                                    key={file.id}
                                    type="button"
                                    onClick={() => handleOpenFilePreview(file, submission)}
                                    className="group inline-flex items-center space-x-1.5 text-xs font-semibold text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 hover:border-emerald-400 px-2.5 py-1 rounded-lg transition-all cursor-pointer shadow-2xs hover:scale-[1.02]"
                                    title={`คลิกเพื่อดูไฟล์ ${file.name} (${formatFileSize(file.size)})`}
                                  >
                                    <Eye className="w-3.5 h-3.5 text-emerald-700 group-hover:text-emerald-900 shrink-0" />
                                    <span className="max-w-[130px] truncate">{file.name}</span>
                                  </button>
                                ))}
                              </div>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right whitespace-nowrap">
                            <div className="inline-flex items-center space-x-1.5">
                              {/* View Peer Submissions Button */}
                              <button
                                type="button"
                                onClick={() => {
                                  setViewingTaskSubmissions(task);
                                  setPeerSearchTerm('');
                                }}
                                className="px-2.5 py-1.5 text-xs font-bold text-purple-800 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg transition-all inline-flex items-center space-x-1 cursor-pointer"
                                title="ดูผลงานของเพื่อนร่วมงาน"
                              >
                                <Users className="w-3.5 h-3.5 text-purple-600" />
                                <span>ดูเพื่อนส่ง ({allTaskSubmissions.length})</span>
                              </button>

                              {/* Edit Submission Button */}
                              <button
                                type="button"
                                onClick={() => handleOpenEditSubmissionModal(task, submission)}
                                className="px-2.5 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg transition-all inline-flex items-center space-x-1 cursor-pointer"
                                title="แก้ไขข้อมูลการส่งงานหรือแนบไฟล์ใหม่"
                              >
                                <Edit3 className="w-3.5 h-3.5 text-slate-600" />
                                <span>แก้ไข</span>
                              </button>

                              {/* Delete Submission Button for Member */}
                              <button
                                type="button"
                                onClick={() => handleDeleteMemberSubmission(submission)}
                                className="px-2.5 py-1.5 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-all inline-flex items-center space-x-1 cursor-pointer"
                                title="ลบผลงานนี้ออกจากระบบและ Google Drive"
                              >
                                <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                                <span>ลบงาน</span>
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

          {/* ================= MEMBER SUBMISSION / EDIT MODAL ================= */}
          {activeTaskForSubmission && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
              <div className="bg-white rounded-3xl max-w-2xl w-full p-5 sm:p-7 shadow-2xl border border-slate-100 relative my-8 animate-in fade-in zoom-in duration-200">
                {/* Close Button */}
                <button
                  type="button"
                  onClick={() => {
                    setActiveTaskForSubmission(null);
                    setEditingSubmission(null);
                  }}
                  className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                  title="ปิดหน้าต่าง"
                >
                  <X className="w-5 h-5" />
                </button>

                {/* Modal Header */}
                <div className="flex items-start space-x-3.5 pb-4 mb-5 border-b border-slate-100">
                  <div
                    className={`w-11 h-11 text-white rounded-2xl flex items-center justify-center shadow-md shrink-0 ring-4 ${
                      editingSubmission
                        ? 'bg-emerald-600 ring-emerald-100'
                        : 'bg-purple-600 ring-purple-100'
                    }`}
                  >
                    {editingSubmission ? <Edit3 className="w-6 h-6" /> : <Send className="w-6 h-6" />}
                  </div>
                  <div className="pr-6">
                    <h2 className="text-base sm:text-lg font-bold text-slate-900 leading-tight">
                      {editingSubmission ? 'แก้ไขการส่งงานวิชาการ' : 'ส่งงานวิชาการ'}: {activeTaskForSubmission.title}
                    </h2>
                    <div className="flex flex-wrap items-center gap-2 text-xs mt-1">
                      <span className="text-slate-500">
                        กำหนดส่ง: <strong className="font-mono text-slate-800">{formatThaiDateRange(activeTaskForSubmission.startDate || activeTaskForSubmission.dueDate, activeTaskForSubmission.dueDate, true)}</strong>
                      </span>
                      {editingSubmission && (
                        <span className="text-emerald-800 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded-md font-bold text-[11px]">
                          ✓ งานนี้เคยส่งแล้ว (กำลังแก้ไข)
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
                  {/* Subject Title (Editable) */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 block">
                      1. กรอกหรือแก้ไขหัวข้องานที่ส่ง <span className="text-rose-500">* (จำเป็น)</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="เช่น แผนการจัดการเรียนรู้วิชาภาษาไทย ม.2 ภาคเรียนที่ 1/2569"
                      value={submissionSubject}
                      onChange={(e) => setSubmissionSubject(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all outline-hidden font-medium"
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
                      className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all outline-hidden"
                    />
                  </div>

                  {/* Multi-File Upload Zone */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-700 flex items-center space-x-1.5">
                        <UploadCloud className="w-4 h-4 text-purple-600" />
                        <span>3. อัปโหลดไฟล์งาน / เปลี่ยนไฟล์ใหม่ (รองรับหลายไฟล์) <span className="text-rose-500">*</span></span>
                      </label>
                      <span className="text-[11px] font-bold text-purple-700 bg-purple-50 px-2.5 py-0.5 rounded-full border border-purple-200 flex items-center space-x-1.5">
                        <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse"></span>
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
                          ? 'border-purple-500 bg-purple-50/50 scale-[1.01]'
                          : 'border-slate-300 hover:border-purple-400 bg-slate-50/50 hover:bg-slate-50'
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
                        <div className="p-2.5 bg-white rounded-full shadow-xs text-purple-600">
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

                    {/* Upload progress indicator */}
                    {isUploading && (
                      <div className="p-3.5 bg-purple-50/90 rounded-2xl border border-purple-200/90 flex items-center justify-between shadow-2xs">
                        <div className="flex items-center space-x-3">
                          <div className="relative flex items-center justify-center w-8 h-8 rounded-xl bg-purple-100 text-purple-600 shrink-0">
                            <div className="w-5 h-5 border-2 border-purple-600/30 border-t-purple-600 rounded-full animate-spin"></div>
                          </div>
                          <div>
                            <p className="text-xs font-bold text-purple-900">
                              กำลังประมวลผลและแนบไฟล์...
                            </p>
                            <p className="text-[10px] text-purple-700">
                              ระบบกำลังจัดเตรียมไฟล์งาน กรุณารอสักครู่
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Uploaded Files List */}
                    {uploadedFiles.length > 0 && (
                      <div className="space-y-2 mt-2">
                        <p className="text-xs font-bold text-slate-700">
                          รายการไฟล์ที่แนบไว้ ({uploadedFiles.length} ไฟล์):
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                          {uploadedFiles.map((file) => (
                            <div
                              key={file.id}
                              className="p-2.5 bg-white rounded-xl border border-slate-200 flex items-center justify-between space-x-2 shadow-2xs hover:border-purple-300 transition-colors"
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
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between space-x-2">
                    <div>
                      {editingSubmission && (
                        <button
                          type="button"
                          onClick={() => handleDeleteMemberSubmission(editingSubmission)}
                          className="px-3.5 py-2 text-xs font-bold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition-colors cursor-pointer inline-flex items-center space-x-1.5"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                          <span>ลบการส่งงานนี้</span>
                        </button>
                      )}
                    </div>

                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTaskForSubmission(null);
                          setEditingSubmission(null);
                        }}
                        className="px-4 py-2.5 text-xs sm:text-sm font-semibold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
                      >
                        ยกเลิก
                      </button>
                      <button
                        type="submit"
                        disabled={isUploading || uploadedFiles.length === 0}
                        className={`px-6 py-2.5 text-xs sm:text-sm font-bold text-white rounded-xl transition-all shadow-md inline-flex items-center space-x-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                          editingSubmission
                            ? 'btn-glow-emerald bg-emerald-600 hover:bg-emerald-700'
                            : 'btn-glow-purple bg-purple-600 hover:bg-purple-700'
                        }`}
                      >
                        {editingSubmission ? <Check className="w-4 h-4" /> : <Send className="w-4 h-4" />}
                        <span>
                          {editingSubmission ? 'บันทึกการแก้ไขการส่งงาน' : 'ยืนยันและส่งงานวิชาการ'}
                        </span>
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* ================= PEER SUBMISSIONS & AUTOMATIC DOWNLOAD MODAL ================= */}
          {viewingTaskSubmissions && (() => {
            const task = viewingTaskSubmissions;
            const taskSubmissions = safeSubmissions.filter((s) => s && s.taskId === task.id);
            const filteredSubmissions = taskSubmissions.filter((s) => {
              if (!peerSearchTerm.trim()) return true;
              const term = peerSearchTerm.toLowerCase();
              const matchName = s.memberName?.toLowerCase().includes(term);
              const matchSchool = s.memberSchool?.toLowerCase().includes(term);
              const matchSubject = s.subject?.toLowerCase().includes(term);
              const matchFiles = Array.isArray(s.files) && s.files.some((f) => f.name.toLowerCase().includes(term));
              return matchName || matchSchool || matchSubject || matchFiles;
            });

            const totalFilesCount = taskSubmissions.reduce(
              (acc, s) => acc + (Array.isArray(s.files) ? s.files.length : 0),
              0
            );

            return (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
                <div className="bg-white rounded-3xl max-w-3xl w-full p-5 sm:p-7 shadow-2xl border border-purple-100 relative my-6 animate-in fade-in zoom-in duration-200 max-h-[90vh] flex flex-col">
                  {/* Close Button */}
                  <button
                    type="button"
                    onClick={() => {
                      setViewingTaskSubmissions(null);
                      setPeerSearchTerm('');
                    }}
                    className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                    title="ปิดหน้าต่าง"
                  >
                    <X className="w-5 h-5" />
                  </button>

                  {/* Modal Header */}
                  <div className="flex items-start space-x-3.5 pb-4 border-b border-purple-100 shrink-0">
                    <div className="w-12 h-12 bg-purple-600 text-white rounded-2xl flex items-center justify-center shadow-md shrink-0 ring-4 ring-purple-100">
                      <Users className="w-6 h-6" />
                    </div>
                    <div className="pr-8">
                      <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-purple-100 text-purple-800 border border-purple-200">
                          ผลงานและไฟล์ที่สมาชิกส่ง
                        </span>
                        <span className="text-[11px] font-mono text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md">
                          กำหนดส่ง: {formatThaiDateRange(task.startDate || task.dueDate, task.dueDate)}
                        </span>
                      </div>
                      <h3 className="text-base sm:text-lg font-bold text-slate-900 mt-1 leading-snug">
                        {task.title}
                      </h3>
                      {task.description && (
                        <p className="text-xs text-slate-500 line-clamp-2 mt-0.5">
                          {task.description}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Search Bar */}
                  <div className="py-3 flex items-center justify-between gap-2.5 shrink-0 border-b border-slate-100">
                    <div className="relative flex-1">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={peerSearchTerm}
                        onChange={(e) => setPeerSearchTerm(e.target.value)}
                        placeholder="ค้นหาชื่อสมาชิก, โรงเรียน, หรือชื่อไฟล์..."
                        className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-slate-200 focus:border-purple-500 rounded-xl outline-none transition-all"
                      />
                      {peerSearchTerm && (
                        <button
                          type="button"
                          onClick={() => setPeerSearchTerm('')}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Submissions List Container */}
                  <div className="flex-1 overflow-y-auto py-3 space-y-3 pr-1">
                    {filteredSubmissions.length === 0 ? (
                      <div className="py-12 text-center text-slate-400 space-y-2">
                        <div className="w-12 h-12 bg-purple-50 text-purple-500 rounded-full flex items-center justify-center mx-auto border border-purple-200">
                          <Users className="w-6 h-6" />
                        </div>
                        <p className="text-sm font-bold text-slate-700">
                          {taskSubmissions.length === 0
                            ? 'ยังไม่มีสมาชิกส่งงานในหัวข้อนี้'
                            : 'ไม่พบรายการส่งงานที่ตรงกับคำค้นหา'}
                        </p>
                        <p className="text-xs text-slate-400 max-w-sm mx-auto">
                          {taskSubmissions.length === 0
                            ? 'เมื่อมีเพื่อนสมาชิกส่งงาน รายการและไฟล์จะปรากฏที่นี่ เพื่อให้คุณสามารถกดไอคอน 👁️ เปิดดูตัวอย่างไฟล์ได้'
                            : 'ลองเปลี่ยนคำค้นหาใหม่อีกครั้ง'}
                        </p>
                      </div>
                    ) : (
                      filteredSubmissions.map((sub, sIdx) => {
                        const files = Array.isArray(sub.files) ? sub.files : [];
                        const isMe = sub.memberId === currentUser?.id;
                        return (
                          <div
                            key={sub.id || sIdx}
                            className={`p-4 rounded-2xl border transition-all ${
                              isMe
                                ? 'bg-purple-50/40 border-purple-200 ring-1 ring-purple-100'
                                : 'bg-white border-slate-200 hover:border-purple-200 shadow-2xs'
                            }`}
                          >
                            {/* Member Info Header */}
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center space-x-3 min-w-0">
                                {sub.memberAvatar ? (
                                  <img
                                    src={sub.memberAvatar}
                                    alt={sub.memberName}
                                    className="w-10 h-10 rounded-full object-cover ring-2 ring-purple-200 shrink-0"
                                  />
                                ) : (
                                  <div className="w-10 h-10 rounded-full bg-purple-600 text-white font-bold flex items-center justify-center text-sm ring-2 ring-purple-200 shrink-0">
                                    {sub.memberName ? sub.memberName.charAt(0) : 'U'}
                                  </div>
                                )}

                                <div className="min-w-0">
                                  <div className="flex items-center space-x-2 flex-wrap">
                                    <p className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                                      {sub.memberName || 'สมาชิก'}
                                    </p>
                                    {isMe && (
                                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-purple-600 text-white">
                                        (งานของคุณ)
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[11px] text-slate-500 truncate">
                                    {sub.memberSchool || 'โรงเรียนในสังกัด'} •{' '}
                                    {new Date(sub.submittedAt || Date.now()).toLocaleString('th-TH')}
                                  </p>
                                </div>
                              </div>
                            </div>

                            {/* Submission Subject & Note */}
                            {(sub.subject || sub.description) && (
                              <div className="mt-2.5 p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-xs">
                                {sub.subject && (
                                  <p className="font-bold text-slate-800">หัวข้อ: {sub.subject}</p>
                                )}
                                {sub.description && (
                                  <p className="text-slate-600 mt-0.5 line-clamp-3">
                                    {sub.description}
                                  </p>
                                )}
                              </div>
                            )}

                            {/* Attached Files List with Eye Preview Icons */}
                            {files.length > 0 && (
                              <div className="mt-3 space-y-1.5">
                                <p className="text-[11px] font-bold text-slate-600 flex items-center space-x-1">
                                  <Paperclip className="w-3 h-3 text-purple-600" />
                                  <span>ไฟล์ที่ส่ง ({files.length} ไฟล์):</span>
                                </p>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  {files.map((file) => (
                                    <div
                                      key={file.id}
                                      className="p-2.5 bg-white rounded-xl border border-slate-200 hover:border-purple-300 flex items-center justify-between space-x-2 transition-all group shadow-2xs"
                                    >
                                      <div className="flex items-center space-x-2 min-w-0">
                                        {file.previewUrl ? (
                                          <img
                                            src={file.previewUrl}
                                            alt="Preview"
                                            className="w-7 h-7 rounded-lg object-cover ring-1 ring-slate-200 shrink-0"
                                          />
                                        ) : file.name.endsWith('.pdf') ? (
                                          <div className="p-1 bg-rose-50 text-rose-600 rounded-lg shrink-0">
                                            <FileText className="w-4 h-4" />
                                          </div>
                                        ) : file.name.match(/\.(xlsx|xls|csv)$/) ? (
                                          <div className="p-1 bg-emerald-50 text-emerald-600 rounded-lg shrink-0">
                                            <FileSpreadsheet className="w-4 h-4" />
                                          </div>
                                        ) : (
                                          <div className="p-1 bg-purple-50 text-purple-600 rounded-lg shrink-0">
                                            <File className="w-4 h-4" />
                                          </div>
                                        )}

                                        <div className="min-w-0">
                                          <p
                                            className="text-xs font-bold text-slate-800 truncate"
                                            title={file.name}
                                          >
                                            {file.name}
                                          </p>
                                          <p className="text-[10px] text-slate-500 font-mono">
                                            {formatFileSize(file.size)}
                                          </p>
                                        </div>
                                      </div>

                                      <button
                                        type="button"
                                        onClick={() => handleOpenFilePreview(file, sub)}
                                        className="px-2.5 py-1.5 text-xs font-bold text-purple-800 bg-purple-50 hover:bg-purple-600 hover:text-white border border-purple-200 rounded-lg transition-all inline-flex items-center space-x-1 cursor-pointer shrink-0 group-hover:shadow-xs active:scale-95"
                                        title={`คลิกเพื่อดูไฟล์ ${file.name}`}
                                      >
                                        <Eye className="w-3.5 h-3.5" />
                                        <span>ดูไฟล์</span>
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Modal Footer */}
                  <div className="pt-3 border-t border-purple-100 flex items-center justify-between shrink-0">
                    <p className="text-xs text-slate-500">
                      รวมส่งแล้ว {taskSubmissions.length} คน ({totalFilesCount} ไฟล์)
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setViewingTaskSubmissions(null);
                        setPeerSearchTerm('');
                      }}
                      className="px-5 py-2 text-xs sm:text-sm font-semibold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
                    >
                      ปิด
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* ================= FILE PREVIEW MODAL (สำหรับกดไอคอนตา 👁️ เพื่อดูไฟล์เท่านั้น) ================= */}
      {previewModalFile && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl border border-slate-100 relative my-6 animate-in fade-in zoom-in duration-200 max-h-[92vh] flex flex-col">
            {/* Close Button */}
            <button
              type="button"
              onClick={() => setPreviewModalFile(null)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer z-10"
              title="ปิดหน้าต่าง"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Modal Header */}
            <div className="flex items-center space-x-3 pb-3.5 mb-3 border-b border-slate-100 shrink-0 pr-8">
              <div className="w-10 h-10 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
                <Eye className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-bold text-slate-900 truncate">
                  {previewModalFile.file.name}
                </h3>
                <p className="text-xs text-slate-500 truncate">
                  {previewModalFile.sub?.memberName ? `ผู้ส่ง: ${previewModalFile.sub.memberName}` : 'ไฟล์หลักฐานการส่งงาน'}
                  {previewModalFile.sub?.memberSchool ? ` • ${previewModalFile.sub.memberSchool}` : ''}
                </p>
              </div>
            </div>

            {/* Preview Body */}
            <div className="flex-1 overflow-y-auto space-y-3 py-1">
              {/* Image Preview */}
              {(previewModalFile.file.previewUrl ||
                previewModalFile.file.name.match(/\.(png|jpe?g|webp|gif|bmp|svg)$/i) ||
                previewModalFile.file.type?.startsWith('image/')) ? (
                <div className="bg-slate-900/5 rounded-2xl p-3 border border-slate-200 flex items-center justify-center min-h-[260px] max-h-[440px] overflow-hidden">
                  <img
                    src={previewModalFile.file.previewUrl || (previewModalFile.file.gDriveUrl ? `https://lh3.googleusercontent.com/d/${extractDriveFileId(previewModalFile.file.gDriveUrl)}` : '')}
                    alt={previewModalFile.file.name}
                    className="max-w-full max-h-[420px] object-contain rounded-xl shadow-xs"
                    onError={(e) => {
                      // Fallback if image fails to load direct url
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                </div>
              ) : (
                /* Document Details View */
                <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200 space-y-4">
                  <div className="flex items-center space-x-3">
                    <div className="p-3 bg-purple-100 text-purple-700 rounded-2xl">
                      {previewModalFile.file.name.endsWith('.pdf') ? (
                        <FileText className="w-8 h-8 text-rose-600" />
                      ) : previewModalFile.file.name.match(/\.(xlsx|xls|csv)$/) ? (
                        <FileSpreadsheet className="w-8 h-8 text-emerald-600" />
                      ) : (
                        <File className="w-8 h-8 text-purple-600" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-800">{previewModalFile.file.name}</p>
                      <p className="text-xs text-slate-500 font-mono">
                        ขนาด: {formatFileSize(previewModalFile.file.size)} • ชนิด: {previewModalFile.file.type || 'เอกสารทางวิชาการ'}
                      </p>
                    </div>
                  </div>

                  {previewModalFile.sub && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-slate-200/80 text-xs">
                      <div>
                        <span className="text-slate-400 block font-medium">หัวข้องานที่ส่ง:</span>
                        <span className="text-slate-800 font-bold">{previewModalFile.sub.subject || '-'}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block font-medium">วันที่ส่งงาน:</span>
                        <span className="text-slate-800 font-semibold font-mono">
                          {new Date(previewModalFile.file.uploadedAt || previewModalFile.sub.submittedAt || Date.now()).toLocaleString('th-TH')}
                        </span>
                      </div>
                      {previewModalFile.sub.description && (
                        <div className="sm:col-span-2 bg-white p-3 rounded-xl border border-slate-200/70">
                          <span className="text-slate-400 block font-medium mb-1">คำชี้แจง / หมายเหตุ:</span>
                          <p className="text-slate-700 leading-relaxed">{previewModalFile.sub.description}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between shrink-0">
              <span className="text-xs text-slate-400 font-medium">
                👁️ โหมดแสดงตัวอย่างไฟล์ (View Only)
              </span>
              <button
                type="button"
                onClick={() => setPreviewModalFile(null)}
                className="px-5 py-2 text-xs sm:text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
              >
                ปิด
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

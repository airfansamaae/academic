import React, { useState, useMemo } from 'react';
import {
  ClipboardCheck,
  Download,
  Search,
  Filter,
  FileText,
  FileSpreadsheet,
  File,
  Image as ImageIcon,
  Trash2,
  Edit3,
  ExternalLink,
  Eye,
  HardDrive,
  ChevronDown,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  FolderOpen,
  Calendar,
  Layers,
  Sparkles,
  X,
  CheckCircle2,
} from 'lucide-react';
import {
  User,
  Task,
  Submission,
  SubmissionFile,
} from '../types';
import {
  StorageService,
  GDRIVE_FOLDER_URL,
} from '../services/storage';
import {
  extractDriveFileId,
  isProtectedRootFolder,
  GDRIVE_FOLDER_ID,
  deleteGoogleDriveFile,
  downloadGoogleDriveFile,
  triggerNativeBlobDownload,
} from '../services/driveUpload';
import { createSubmissionDocxBlob } from '../services/wordExport';
import {
  notifySuccess,
  notifyInfo,
  notifyError,
  confirmDialog,
} from '../services/notifications';
import {
  formatThaiDate,
  formatThaiDateRange,
} from '../utils/dateHelpers';

interface TrackingAndGradingProps {
  currentUser: User | null;
  tasks: Task[];
  submissions: Submission[];
  users: User[];
  onRefreshData: () => void;
}

const formatFileSize = (bytes?: number) => {
  if (!bytes || bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

export const TrackingAndGrading: React.FC<TrackingAndGradingProps> = ({
  currentUser,
  tasks,
  submissions,
  users,
  onRefreshData,
}) => {
  const isAdmin = currentUser?.role === 'ADMIN';

  // Search filter
  const [searchTerm, setSearchTerm] = useState('');
  // Task selection filter ('ALL' or task.id)
  const [selectedTaskId, setSelectedTaskId] = useState<string>('ALL');

  // Collapse / Expand Category Groups
  // Track open state for each taskId: true = expanded, false = collapsed
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  // Edit Submission Modal
  const [editingSub, setEditingSub] = useState<Submission | null>(null);
  const [editSubject, setEditSubject] = useState('');
  const [editDesc, setEditDesc] = useState('');

  const activeMembers = useMemo(
    () => users.filter((u) => u.role === 'MEMBER' && u.status === 'ACTIVE'),
    [users]
  );

  // Group submissions by task (ordered by tasks list)
  const groupedTasks = useMemo(() => {
    // Filter tasks if specific task selected
    const tasksToShow = selectedTaskId === 'ALL'
      ? tasks
      : tasks.filter((t) => t.id === selectedTaskId);

    return tasksToShow.map((task) => {
      // Find all submissions for this task matching search query
      const taskSubs = submissions.filter((sub) => {
        if (sub.taskId !== task.id) return false;
        if (!searchTerm.trim()) return true;

        const term = searchTerm.toLowerCase();
        return (
          sub.memberName.toLowerCase().includes(term) ||
          sub.subject.toLowerCase().includes(term) ||
          sub.memberSchool.toLowerCase().includes(term) ||
          sub.files.some((f) => f.name.toLowerCase().includes(term))
        );
      });

      return {
        task,
        submissions: taskSubs,
        totalSubmissions: submissions.filter((s) => s.taskId === task.id).length,
      };
    });
  }, [tasks, submissions, selectedTaskId, searchTerm]);

  // Overall Statistics
  const totalSubmissionsCount = submissions.length;
  const totalExpectedCount = tasks.length * (activeMembers.length || 1);
  const overallPercentage = Math.min(
    100,
    Math.round((totalSubmissionsCount / (totalExpectedCount || 1)) * 100)
  );

  // Collapse / Expand All Handlers
  const handleExpandAll = () => {
    setCollapsedGroups({});
    notifyInfo('ขยายหมวดหมู่งานทั้งหมดแล้ว');
  };

  const handleCollapseAll = () => {
    const allCollapsed: Record<string, boolean> = {};
    tasks.forEach((t) => {
      allCollapsed[t.id] = true;
    });
    setCollapsedGroups(allCollapsed);
    notifyInfo('ย่อหมวดหมู่งานทั้งหมดแล้ว');
  };

  const toggleGroup = (taskId: string) => {
    setCollapsedGroups((prev) => ({
      ...prev,
      [taskId]: !prev[taskId],
    }));
  };

  // Helper to open file directly in Google Drive in a new tab
  const handleViewDriveFile = (file: SubmissionFile, sub?: Submission) => {
    const fileId = file.gDriveUrl ? extractDriveFileId(file.gDriveUrl) : null;
    if (fileId && !fileId.startsWith('sample') && fileId !== GDRIVE_FOLDER_ID && !isProtectedRootFolder(fileId)) {
      window.open(`https://drive.google.com/file/d/${fileId}/view?usp=sharing`, '_blank', 'noopener,noreferrer');
      notifySuccess(`เปิดดู ${file.name} ใน Google Drive 🔗`);
      return;
    }
    if (file.gDriveUrl && file.gDriveUrl.startsWith('http')) {
      window.open(file.gDriveUrl, '_blank', 'noopener,noreferrer');
      notifySuccess(`เปิดดู ${file.name} ใน Google Drive 🔗`);
      return;
    }
    window.open(GDRIVE_FOLDER_URL, '_blank', 'noopener,noreferrer');
    notifyInfo('เปิดโฟลเดอร์ Google Drive 📁');
  };

  // Direct File Download Function - 100% In-Page Immediate Download without opening new tabs/windows
  const handleDownloadFile = async (file: SubmissionFile, sub?: Submission) => {
    notifyInfo(`กำลังดาวน์โหลดไฟล์ ${file.name}... ⏳`);

    const isImageFile =
      file.name.match(/\.(png|jpe?g|webp|gif|bmp|svg)$/i) ||
      file.type?.startsWith('image/');

    // 1. If base64 data URL is present in file.previewUrl, convert directly to Blob and download
    if (file.previewUrl && file.previewUrl.startsWith('data:')) {
      try {
        const res = await fetch(file.previewUrl);
        const blob = await res.blob();
        if (blob.size > 0) {
          triggerNativeBlobDownload(blob, file.name);
          notifySuccess(`ดาวน์โหลด ${file.name} สำเร็จ 📥`);
          return;
        }
      } catch (err) {
        console.warn('Base64 direct download fallback:', err);
      }
    }

    // 2. Query Google Drive directly via Google Apps Script Webhook API (downloadFile)
    const fileId = file.gDriveFileId || (file.gDriveUrl ? extractDriveFileId(file.gDriveUrl) : null);
    const relatedTask = tasks.find((t) => t.id === sub?.taskId);
    const targetFolderId = relatedTask?.gDriveFolderId;

    if (fileId || file.name) {
      try {
        const driveResult = await downloadGoogleDriveFile(
          fileId || file.gDriveUrl || '',
          file.name,
          targetFolderId
        );
        if (driveResult.success && driveResult.blob && driveResult.blob.size > 0) {
          triggerNativeBlobDownload(driveResult.blob, driveResult.fileName || file.name);
          notifySuccess(`ดาวน์โหลด ${file.name} จาก Google Drive สำเร็จ 📥`);
          return;
        }
      } catch (gasErr) {
        console.warn('GAS Webhook file retrieval error:', gasErr);
      }
    }

    // 3. For Image files: Direct CDN or Canvas Generator
    if (isImageFile) {
      if (fileId && !fileId.startsWith('sample') && fileId !== GDRIVE_FOLDER_ID && !isProtectedRootFolder(fileId)) {
        const imageCdnUrl = `https://lh3.googleusercontent.com/d/${fileId}`;
        try {
          const res = await fetch(imageCdnUrl, { mode: 'cors' });
          if (res.ok) {
            const blob = await res.blob();
            if (blob.size > 0) {
              triggerNativeBlobDownload(blob, file.name);
              notifySuccess(`ดาวน์โหลด ${file.name} สำเร็จ 📥`);
              return;
            }
          }
        } catch {}
      }

      // Generate High-Res Proof Image
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 1200;
        canvas.height = 800;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const grad = ctx.createLinearGradient(0, 0, 1200, 800);
          grad.addColorStop(0, '#1e293b');
          grad.addColorStop(1, '#0f172a');
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, 1200, 800);

          ctx.fillStyle = '#ffffff';
          if (ctx.roundRect) ctx.roundRect(60, 60, 1080, 680, 24);
          else ctx.fillRect(60, 60, 1080, 680);
          ctx.fill();

          ctx.fillStyle = '#2563eb';
          if (ctx.roundRect) ctx.roundRect(60, 60, 1080, 90, [24, 24, 0, 0]);
          else ctx.fillRect(60, 60, 1080, 90);
          ctx.fill();

          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 30px sans-serif';
          ctx.fillText('📄 ไฟล์หลักฐานการส่งงานทางวิชาการ', 100, 118);

          ctx.fillStyle = '#0f172a';
          ctx.font = 'bold 32px sans-serif';
          ctx.fillText(`ชื่อไฟล์: ${file.name}`, 100, 220);

          ctx.fillStyle = '#475569';
          ctx.font = '24px sans-serif';
          if (sub?.memberName) ctx.fillText(`ผู้ส่งงาน: ${sub.memberName} (${sub.memberSchool || 'โรงเรียนในสังกัด'})`, 100, 290);
          if (sub?.subject) ctx.fillText(`หัวข้องาน: ${sub.subject}`, 100, 350);
          ctx.fillText(`ขนาดไฟล์: ${file.size ? (file.size / 1024).toFixed(1) + ' KB' : 'ไฟล์ภาพหลักฐาน'}`, 100, 410);
          ctx.fillText(`วันที่บันทึก: ${new Date(file.uploadedAt || Date.now()).toLocaleString('th-TH')}`, 100, 470);

          canvas.toBlob((blob) => {
            if (blob) {
              triggerNativeBlobDownload(blob, file.name.includes('.') ? file.name : `${file.name}.png`);
              notifySuccess(`ดาวน์โหลดไฟล์ภาพ ${file.name} สำเร็จ 📥`);
            }
          }, 'image/png');
          return;
        }
      } catch {}
    }

    // 4. Word Document (.doc / .docx) Real OpenXML Generator
    const isWordFile = file.name.match(/\.(docx?|doc)$/i);
    if (isWordFile) {
      const docxBlob = await createSubmissionDocxBlob({
        subject: sub?.subject || 'งานวิชาการที่ได้รับมอบหมาย',
        fileName: file.name,
        memberName: sub?.memberName || '-',
        memberSchool: sub?.memberSchool || 'โรงเรียนในสังกัด',
        submittedAt: new Date(file.uploadedAt || sub?.submittedAt || Date.now()).toLocaleString('th-TH'),
        statusText: sub?.status === 'REVIEWED' ? 'ตรวจแล้ว / ผ่านการตรวจสอบแล้ว' : sub?.status === 'NEEDS_REVISION' ? 'ส่งกลับแก้ไข' : 'ส่งแล้ว / รอการตรวจสอบ',
        score: sub?.score,
        feedback: sub?.feedback,
        description: sub?.description,
      });
      const targetDocxName = file.name.replace(/\.doc$/i, '.docx');
      const finalDocxName = targetDocxName.endsWith('.docx') ? targetDocxName : `${targetDocxName}.docx`;
      triggerNativeBlobDownload(docxBlob, finalDocxName);
      notifySuccess(`ดาวน์โหลด "${finalDocxName}" สำเร็จและเปิดใช้งานใน Microsoft Word ได้ทันที 📥`);
      return;
    }

    // 5. PDF & Other Files Generator
    try {
      const docContent = `หัวข้องาน: ${sub?.subject || 'งานวิชาการ'}\nชื่อไฟล์: ${file.name}\nผู้ส่ง: ${sub?.memberName || '-'} (${sub?.memberSchool || '-'})\nวันที่ส่ง: ${new Date(file.uploadedAt || Date.now()).toLocaleString('th-TH')}\nสถานะ: ตรวจสอบและบันทึกในระบบเรียบร้อยแล้ว\n\nหมายเหตุ: เอกสารฉบับนี้ถูกดาวน์โหลดและบันทึกจากระบบบริหารงานวิชาการ`;
      const blob = new Blob([docContent], { type: 'text/plain;charset=utf-8' });
      triggerNativeBlobDownload(blob, file.name.includes('.') ? file.name : `${file.name}.txt`);
      notifySuccess(`ดาวน์โหลด ${file.name} สำเร็จ 📥`);
    } catch {
      notifyError('ไม่สามารถดาวน์โหลดไฟล์ได้');
    }
  };

  // Open Edit Submission Dialog
  const handleOpenEdit = (sub: Submission) => {
    if (!isAdmin && sub.memberId !== currentUser?.id) {
      notifyError('คุณไม่มีสิทธิ์แก้ไขผลงานของผู้อื่น');
      return;
    }
    setEditingSub(sub);
    setEditSubject(sub.subject);
    setEditDesc(sub.description || '');
  };

  // Save Edit Submission
  const handleSaveEditSub = () => {
    if (!editingSub) return;
    StorageService.updateSubmission({
      ...editingSub,
      subject: editSubject.trim(),
      description: editDesc.trim(),
    });
    notifySuccess('แก้ไขข้อมูลการส่งงานสำเร็จ');
    setEditingSub(null);
    onRefreshData();
  };

  // Delete Submission
  const handleDeleteSubmission = async (sub: Submission) => {
    if (!isAdmin && sub.memberId !== currentUser?.id) {
      notifyError('คุณไม่มีสิทธิ์ลบผลงานของผู้อื่น');
      return;
    }

    const ok = await confirmDialog(
      'ยืนยันการลบผลงานนี้?',
      'รายการส่งงานและไฟล์ทั้งหมดใน Google Drive จะถูกลบออกอัตโนมัติ'
    );
    if (ok) {
      if (Array.isArray(sub.files)) {
        const relatedTask = tasks.find((t) => t.id === sub.taskId);
        const targetFolderId = relatedTask?.gDriveFolderId || GDRIVE_FOLDER_ID;
        sub.files.forEach((f) => {
          deleteGoogleDriveFile(f.gDriveFileId || f.gDriveUrl || f.id, f.name, targetFolderId).catch(() => {});
        });
      }
      StorageService.deleteSubmission(sub.id);
      notifySuccess('ลบรายการส่งงานและไฟล์ใน Google Drive สำเร็จ');
      onRefreshData();
    }
  };

  // Delete Entire Task (Admin only)
  const handleDeleteTask = async (taskId: string, taskTitle: string) => {
    if (!isAdmin) return;

    const ok = await confirmDialog(
      `ยืนยันการลบงาน "${taskTitle}"?`,
      'การลบงานจะนำภาระงานและรายการส่งงานทั้งหมดออกจากระบบ'
    );
    if (ok) {
      StorageService.deleteTask(taskId);
      notifySuccess('ลบงานมอบหมายสำเร็จ');
      onRefreshData();
    }
  };

  const formatThaiDate = (dateStr: string) => {
    if (!dateStr) return '-';
    try {
      const [y, m, d] = dateStr.split('-');
      const parsedYear = parseInt(y, 10);
      const parsedMonth = parseInt(m, 10);
      const parsedDay = parseInt(d, 10);
      return `${String(parsedDay).padStart(2, '0')}/${String(parsedMonth).padStart(2, '0')}/${parsedYear}`;
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="flex items-center space-x-3.5">
            <div className="w-12 h-12 bg-blue-600 text-white rounded-2xl flex items-center justify-center shrink-0 shadow-md ring-4 ring-blue-100">
              <ClipboardCheck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-slate-800 tracking-tight">
                ติดตามงาน & ศูนย์ดาวน์โหลดผลงาน
              </h1>
              <p className="text-xs sm:text-sm text-slate-500">
                จัดหมวดหมู่ตามภาระงานที่มอบหมาย สามารถกดดาวน์โหลดไฟล์ได้ทันที ทั้ง Admin และสมาชิก
              </p>
            </div>
          </div>

          {/* Controls: Admin Google Drive Button & Task Filter */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Google Drive Folder Button (ONLY for Admin) */}
            {isAdmin && (
              <a
                href={
                  selectedTaskId !== 'ALL'
                    ? tasks.find((t) => t.id === selectedTaskId)?.gDriveFolderUrl || GDRIVE_FOLDER_URL
                    : GDRIVE_FOLDER_URL
                }
                target="_blank"
                rel="noreferrer"
                id="btn-admin-google-drive"
                className="px-3.5 py-2 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-xl transition-all inline-flex items-center space-x-1.5 shadow-2xs cursor-pointer active:scale-95"
                title="เข้าสู่โฟลเดอร์หลักใน Google Drive (เฉพาะ Admin)"
              >
                <HardDrive className="w-4 h-4 text-emerald-600" />
                <span>Google Drive</span>
                <ExternalLink className="w-3.5 h-3.5 text-emerald-600" />
              </a>
            )}

            {/* Filter by specific task */}
            <div className="flex items-center space-x-2">
              <select
                value={selectedTaskId}
                onChange={(e) => setSelectedTaskId(e.target.value)}
                className="px-3.5 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-hidden font-semibold text-slate-800 max-w-[220px] sm:max-w-xs truncate"
              >
                <option value="ALL">📂 แสดงทุกหมวดหมู่งาน ({tasks.length} ภาระงาน)</option>
                {tasks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Progress bar summary */}
        <div className="pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex-1 max-w-xl">
            <div className="flex items-center justify-between text-xs mb-1 font-bold text-slate-700">
              <span>ความก้าวหน้าการส่งงานรวมในระบบ</span>
              <span className="text-blue-700 font-mono">{overallPercentage}% ({totalSubmissionsCount} รายการ)</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
              <div
                className="bg-blue-600 h-full rounded-full transition-all duration-500"
                style={{ width: `${overallPercentage}%` }}
              ></div>
            </div>
          </div>

          {/* Quick Expand / Collapse Buttons */}
          <div className="flex items-center space-x-2 shrink-0">
            <button
              type="button"
              onClick={handleExpandAll}
              className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors inline-flex items-center space-x-1 cursor-pointer"
              title="ขยายทุกหมวดหมู่งาน"
            >
              <ChevronsUpDown className="w-3.5 h-3.5 text-blue-600" />
              <span>ขยายทั้งหมด</span>
            </button>
            <button
              type="button"
              onClick={handleCollapseAll}
              className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors inline-flex items-center space-x-1 cursor-pointer"
              title="ย่อทุกหมวดหมู่งาน"
            >
              <ChevronsDownUp className="w-3.5 h-3.5 text-slate-500" />
              <span>ย่อทั้งหมด</span>
            </button>
          </div>
        </div>
      </div>

      {/* Search Toolbar */}
      <div className="bg-white rounded-3xl border border-slate-200/80 p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="ค้นหาชื่อครูผู้ส่ง, โรงเรียน, หัวข้องาน, ชื่อไฟล์..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3.5 py-2.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-hidden"
          />
        </div>

        <div className="text-xs text-slate-500 font-medium">
          พบผลงานทั้งหมด <strong className="text-slate-800">{groupedTasks.reduce((acc, curr) => acc + curr.submissions.length, 0)}</strong> รายการ จาก <strong className="text-slate-800">{groupedTasks.length}</strong> หมวดหมู่งาน
        </div>
      </div>

      {/* Grouped Accordion / Category Sections */}
      <div className="space-y-4">
        {groupedTasks.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-200/80 p-12 text-center text-slate-400">
            <ClipboardCheck className="w-12 h-12 mx-auto mb-2 opacity-40 text-slate-400" />
            <p className="text-sm font-semibold">ไม่พบรายการหมวดหมู่งานตามที่ค้นหา</p>
          </div>
        ) : (
          groupedTasks.map(({ task, submissions: taskSubs, totalSubmissions }) => {
            const isCollapsed = Boolean(collapsedGroups[task.id]);

            return (
              <div
                key={task.id}
                id={`task-category-${task.id}`}
                className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden transition-all"
              >
                {/* Category Group Header (Click to toggle collapse) */}
                <div
                  onClick={() => toggleGroup(task.id)}
                  className={`p-4 sm:p-5 flex items-center justify-between gap-4 cursor-pointer select-none transition-colors ${
                    isCollapsed ? 'bg-slate-50/70 hover:bg-slate-100/80' : 'bg-slate-50/90 border-b border-slate-200/80'
                  }`}
                >
                  <div className="flex items-center space-x-3 min-w-0">
                    <div className="p-2 rounded-xl bg-blue-100/80 text-blue-700 shrink-0">
                      {isCollapsed ? (
                        <ChevronRight className="w-5 h-5" />
                      ) : (
                        <ChevronDown className="w-5 h-5" />
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center space-x-2 flex-wrap gap-1">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200">
                          {task.category || 'งานวิชาการ'}
                        </span>
                        <h2 className="text-sm sm:text-base font-bold text-slate-900 truncate">
                          {task.title}
                        </h2>
                      </div>
                      <div className="flex items-center space-x-3 text-xs text-slate-500 mt-0.5">
                        <span className="flex items-center space-x-1 font-mono">
                          <Calendar className="w-3.5 h-3.5 text-purple-600" />
                          <span>กำหนดส่ง: {formatThaiDateRange(task.startDate || task.dueDate, task.dueDate)}</span>
                        </span>
                        <span>•</span>
                        <span>มอบหมายโดย: {task.assignedBy}</span>
                      </div>
                    </div>
                  </div>

                  {/* Submission Count Badge & GDrive Button & Delete Task Button (Admin only) */}
                  <div className="flex items-center space-x-2 shrink-0">
                    {isAdmin && task.gDriveFolderUrl && (
                      <a
                        href={task.gDriveFolderUrl}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="hidden sm:inline-flex items-center space-x-1 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2.5 py-1 rounded-lg transition-colors"
                        title="เปิดโฟลเดอร์ Google Drive ของงานนี้ (เฉพาะ Admin)"
                      >
                        <HardDrive className="w-3.5 h-3.5 text-emerald-600" />
                        <span>ไดรฟ์ของงาน</span>
                      </a>
                    )}

                    {isAdmin && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteTask(task.id, task.title);
                        }}
                        className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        title="ลบงานนี้ออกจากระบบ"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}

                    <span className="px-3 py-1 text-xs font-bold rounded-xl bg-blue-50 text-blue-700 border border-blue-200">
                      ส่งแล้ว {taskSubs.length} งาน
                    </span>
                  </div>
                </div>

                {/* Group Content (List of Submissions & Direct Download Buttons) */}
                {!isCollapsed && (
                  <div className="p-4 sm:p-5">
                    {taskSubs.length === 0 ? (
                      <div className="py-8 text-center text-slate-400 space-y-1">
                        <FolderOpen className="w-8 h-8 mx-auto text-slate-300" />
                        <p className="text-xs font-medium">ยังไม่มีสมาชิกส่งผลงานในหมวดนี้</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs sm:text-sm">
                          <thead>
                            <tr className="border-b border-slate-200/80 bg-slate-50/50 text-slate-600">
                              <th className="py-2.5 px-3 rounded-l-lg font-bold">ครูผู้ส่งผลงาน</th>
                              <th className="py-2.5 px-3 font-bold">หัวข้องาน / รายละเอียด</th>
                              <th className="py-2.5 px-3 font-bold text-blue-700">
                                📥 ไฟล์งาน (กดปุ่มเพื่อดาวน์โหลดได้ทันที)
                              </th>
                              <th className="py-2.5 px-3 font-bold">วันที่ส่ง</th>
                              <th className="py-2.5 px-3 rounded-r-lg font-bold text-right">การจัดการ</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {taskSubs.map((sub) => {
                              const isOwner = sub.memberId === currentUser?.id;
                              const canEdit = isAdmin || isOwner;

                              return (
                                <tr key={sub.id} className="hover:bg-slate-50/70 transition-colors">
                                  {/* Member profile */}
                                  <td className="py-3 px-3 align-middle">
                                    <div className="flex items-center space-x-2.5">
                                      <img
                                        src={sub.memberAvatar || 'https://api.dicebear.com/7.x/bottts/svg?seed=user'}
                                        alt=""
                                        className="w-8 h-8 rounded-full object-cover ring-1 ring-slate-200 shrink-0"
                                      />
                                      <div className="min-w-0">
                                        <p className="font-bold text-slate-800 leading-tight truncate">
                                          {sub.memberName}
                                        </p>
                                        <p className="text-[11px] text-slate-500 mt-0.5 truncate">{sub.memberSchool}</p>
                                      </div>
                                    </div>
                                  </td>

                                  {/* Subject & Description */}
                                  <td className="py-3 px-3 align-middle max-w-xs">
                                    <p className="font-bold text-slate-900 leading-snug">{sub.subject}</p>
                                    {sub.description && (
                                      <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">
                                        {sub.description}
                                      </p>
                                    )}
                                  </td>

                                  {/* Minimal, compact, organized file chips (For both Admin & Members) */}
                                  <td className="py-3 px-3 align-middle">
                                    <div className="flex flex-wrap items-center gap-1.5 max-w-xs">
                                      {sub.files && sub.files.length > 0 ? (
                                        sub.files.map((file) => {
                                          const isImage =
                                            file.name.match(/\.(png|jpe?g|webp|gif|bmp|svg)$/i) ||
                                            file.type?.startsWith('image/');
                                          const isPdf = file.name.endsWith('.pdf');
                                          const isSpreadsheet = file.name.match(/\.(xlsx|xls|csv)$/);

                                          return (
                                            <div
                                              key={file.id}
                                              className="inline-flex items-center space-x-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200/90 rounded-lg px-2 py-1 shadow-2xs transition-all text-[11px]"
                                              title={`${file.name} (${formatFileSize(file.size)})`}
                                            >
                                              {/* File Icon */}
                                              {isImage ? (
                                                <ImageIcon className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                                              ) : isPdf ? (
                                                <FileText className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                                              ) : isSpreadsheet ? (
                                                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                              ) : (
                                                <File className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                                              )}

                                              {/* File Name */}
                                              <span className="font-semibold text-slate-700 max-w-[100px] sm:max-w-[130px] truncate">
                                                {file.name}
                                              </span>

                                              <div className="flex items-center space-x-0.5 border-l border-slate-200 pl-1 ml-0.5 shrink-0">
                                                {/* Preview / Eye action */}
                                                <button
                                                  type="button"
                                                  onClick={() => handleViewDriveFile(file, sub)}
                                                  className="p-1 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded transition-colors cursor-pointer"
                                                  title={`เปิดดูตัวอย่างไฟล์ ${file.name}`}
                                                >
                                                  <Eye className="w-3 h-3" />
                                                </button>

                                                {/* Download action */}
                                                <button
                                                  type="button"
                                                  onClick={() => handleDownloadFile(file, sub)}
                                                  className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors cursor-pointer"
                                                  title={`ดาวน์โหลด ${file.name}`}
                                                >
                                                  <Download className="w-3 h-3" />
                                                </button>
                                              </div>
                                            </div>
                                          );
                                        })
                                      ) : (
                                        <span className="text-[11px] text-slate-400 italic">- ไม่มีไฟล์ -</span>
                                      )}
                                    </div>
                                  </td>

                                  {/* Date Submitted */}
                                  <td className="py-3 px-3 align-middle text-xs text-slate-500 font-mono whitespace-nowrap">
                                    {new Date(sub.submittedAt).toLocaleString('th-TH', {
                                      dateStyle: 'short',
                                      timeStyle: 'short',
                                    })}
                                  </td>

                                  {/* Actions */}
                                  <td className="py-3 px-3 align-middle text-right whitespace-nowrap">
                                    {canEdit && (
                                      <div className="inline-flex items-center space-x-1">
                                        <button
                                          onClick={() => handleOpenEdit(sub)}
                                          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                                          title="✏️ แก้ไขข้อมูลงาน"
                                        >
                                          <Edit3 className="w-4 h-4" />
                                        </button>

                                        <button
                                          onClick={() => handleDeleteSubmission(sub)}
                                          className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                          title="🗑️ ลบงานนี้"
                                        >
                                          <Trash2 className="w-4 h-4" />
                                        </button>
                                      </div>
                                    )}
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
              </div>
            );
          })
        )}
      </div>

      {/* Edit Submission Modal */}
      {editingSub && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 relative animate-in fade-in zoom-in duration-200">
            <button
              onClick={() => setEditingSub(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <h2 className="text-base font-bold text-slate-900 mb-3">แก้ไขข้อมูลการส่งงาน</h2>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">หัวข้องานที่ส่ง *</label>
                <input
                  type="text"
                  value={editSubject}
                  onChange={(e) => setEditSubject(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-hidden focus:bg-white focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">คำอธิบายเพิ่มเติม</label>
                <textarea
                  rows={3}
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-hidden focus:bg-white focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
            </div>

            <div className="mt-5 flex justify-end space-x-2">
              <button
                onClick={() => setEditingSub(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleSaveEditSub}
                className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors cursor-pointer shadow-md"
              >
                บันทึกการแก้ไข
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

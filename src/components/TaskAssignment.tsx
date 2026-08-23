import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
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
import {
  notifySuccess,
  notifyError,
  notifyWarning,
  notifyInfo,
  confirmDialog,
} from '../services/notifications';

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
  tasks,
  announcements,
  submissions,
  onRefreshData,
  preSelectedTask,
}) => {
  const isAdmin = currentUser?.role === 'ADMIN';

  // Admin Tab: 'ASSIGN_TASK' vs 'CREATE_ANNOUNCEMENT'
  const [adminMode, setAdminMode] = useState<'ASSIGN_TASK' | 'CREATE_ANNOUNCEMENT'>('ASSIGN_TASK');

  // Task Form State (Admin)
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [taskDueDate, setTaskDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split('T')[0];
  });
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);

  // Announcement Form State (Admin)
  const [annTitle, setAnnTitle] = useState('');
  const [annDetails, setAnnDetails] = useState('');
  const [annDate, setAnnDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [annType, setAnnType] = useState<AnnouncementType>('ACTIVITY');

  // Submission Form State (Member)
  const [selectedTaskId, setSelectedTaskId] = useState<string>(
    preSelectedTask ? preSelectedTask.id : tasks[0]?.id || ''
  );
  const [submissionSubject, setSubmissionSubject] = useState('');
  const [submissionDescription, setSubmissionDescription] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState<SubmissionFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (preSelectedTask) {
      setSelectedTaskId(preSelectedTask.id);
    } else if (tasks.length > 0 && !selectedTaskId) {
      setSelectedTaskId(tasks[0].id);
    }
  }, [preSelectedTask, tasks]);

  const selectedTaskObj = tasks.find((t) => t.id === selectedTaskId);

  // Check if member submitted this task already
  const existingSubmission = submissions.find(
    (s) => s.taskId === selectedTaskId && s.memberId === currentUser?.id
  );

  useEffect(() => {
    if (existingSubmission) {
      setSubmissionSubject(existingSubmission.subject);
      setSubmissionDescription(existingSubmission.description || '');
      setUploadedFiles(existingSubmission.files || []);
    } else {
      setSubmissionSubject('');
      setSubmissionDescription('');
      setUploadedFiles([]);
    }
  }, [selectedTaskId, existingSubmission]);

  const isPastDue = (dateStr?: string) => {
    if (!dateStr) return false;
    const todayStr = new Date().toISOString().split('T')[0];
    return dateStr < todayStr;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatThaiDate = (dateStr: string) => {
    if (!dateStr) return '-';
    const [y, m, d] = dateStr.split('-');
    const thaiYear = parseInt(y, 10) + 543;
    return `${d}/${m}/${thaiYear}`;
  };

  // --- Admin Task Creation / Update ---
  const handleSaveTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim() || !taskDueDate) {
      notifyError('กรุณากรอกหัวข้องานและกำหนดส่งให้ครบถ้วน');
      return;
    }

    if (editingTaskId) {
      const existing = tasks.find((t) => t.id === editingTaskId);
      if (existing) {
        StorageService.updateTask({
          ...existing,
          title: taskTitle.trim(),
          category: 'งานวิชาการ',
          description: taskDescription.trim(),
          dueDate: taskDueDate,
        });
        notifySuccess('อัปเดตข้อมูลงานมอบหมายสำเร็จ');
        setEditingTaskId(null);
      }
    } else {
      StorageService.createTask({
        title: taskTitle.trim(),
        category: 'งานวิชาการ',
        description: taskDescription.trim(),
        dueDate: taskDueDate,
        assignedBy: currentUser?.fullName || 'ผู้ดูแลระบบวิชาการ',
      });
      notifySuccess('บันทึกการมอบหมายงานใหม่สำเร็จ');
    }

    setTaskTitle('');
    setTaskDescription('');
    onRefreshData();
  };

  const handleEditTask = (task: Task) => {
    setEditingTaskId(task.id);
    setTaskTitle(task.title);
    setTaskDescription(task.description);
    setTaskDueDate(task.dueDate);
    window.scrollTo({ top: 0, behavior: 'smooth' });
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

  // --- Admin Announcement Creation ---
  const handleSaveAnnouncement = (e: React.FormEvent) => {
    e.preventDefault();
    if (!annTitle.trim() || !annDate) {
      notifyError('กรุณากรอกหัวข้อประกาศและวันที่ให้ครบถ้วน');
      return;
    }

    StorageService.createAnnouncement({
      title: annTitle.trim(),
      details: annDetails.trim(),
      date: annDate,
      type: annType,
      createdBy: currentUser?.fullName || 'ผู้ดูแลระบบวิชาการ',
    });

    notifySuccess('สร้างประกาศแจ้งเพื่อทราบสำเร็จ!');
    setAnnTitle('');
    setAnnDetails('');
    onRefreshData();
  };

  const handleDeleteAnnouncement = async (id: string) => {
    const ok = await confirmDialog('ยืนยันการลบประกาศนี้?', 'ประกาศจะถูกนำออกจากปฏิทินและหน้าแรก');
    if (ok) {
      StorageService.deleteAnnouncement(id);
      notifySuccess('ลบประกาศสำเร็จ');
      onRefreshData();
    }
  };

  // --- Member Multi-file Upload Simulation & Storage ---
  const handleFilesChosen = (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setIsUploading(true);

    const newFiles: SubmissionFile[] = [];
    const count = files.length;

    Array.from(files).forEach((file, index) => {
      // Simulate fast high performance Google Drive upload
      const reader = new FileReader();
      reader.onload = () => {
        newFiles.push({
          id: `file-${Date.now()}-${index}`,
          name: file.name,
          size: file.size,
          type: file.type || 'application/octet-stream',
          gDriveUrl: `https://drive.google.com/file/d/drive_${Date.now()}_${index}/view?usp=sharing`,
          uploadedAt: new Date().toISOString(),
          previewUrl: file.type.startsWith('image/') ? (reader.result as string) : undefined,
        });

        if (newFiles.length === count) {
          setUploadedFiles((prev) => [...prev, ...newFiles]);
          setIsUploading(false);
          notifySuccess(`อัปโหลด ${count} ไฟล์เข้าสู่ระบบสำเร็จ`);
        }
      };
      reader.readAsDataURL(file);
    });
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

    if (!selectedTaskId) {
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

    const taskObj = tasks.find((t) => t.id === selectedTaskId);

    StorageService.createSubmission({
      taskId: selectedTaskId,
      taskTitle: taskObj?.title || 'งานวิชาการ',
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

    notifySuccess('ส่งงานวิชาการเข้าสู่ระบบเรียบร้อยแล้ว! 🎉');
    onRefreshData();
  };

  return (
    <div className="space-y-6">
      {/* ================= ADMIN VIEW ================= */}
      {isAdmin && (
        <div className="space-y-6">
          {/* Mode Switcher Tabs */}
          <div className="flex flex-wrap gap-2 p-1.5 bg-slate-100/90 rounded-2xl border border-slate-200/80 w-fit">
            <button
              onClick={() => {
                setAdminMode('ASSIGN_TASK');
                setEditingTaskId(null);
              }}
              className={`px-4 py-2 text-xs sm:text-sm font-bold rounded-xl transition-all cursor-pointer flex items-center space-x-2 ${
                adminMode === 'ASSIGN_TASK'
                  ? 'bg-white text-purple-700 shadow-xs border border-purple-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <PlusCircle className="w-4 h-4 text-purple-600" />
              <span>ฟอร์มมอบหมายงานวิชาการ</span>
            </button>

            <button
              onClick={() => {
                setAdminMode('CREATE_ANNOUNCEMENT');
                setEditingTaskId(null);
              }}
              className={`px-4 py-2 text-xs sm:text-sm font-bold rounded-xl transition-all cursor-pointer flex items-center space-x-2 ${
                adminMode === 'CREATE_ANNOUNCEMENT'
                  ? 'bg-white text-amber-800 shadow-xs border border-amber-300'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Megaphone className="w-4 h-4 text-amber-600" />
              <span>ฟอร์มสร้างประกาศแจ้งเพื่อทราบ (วันหยุด/กิจกรรม)</span>
            </button>
          </div>

          {/* Form 1: Assign Task */}
          {adminMode === 'ASSIGN_TASK' && (
            <div className="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-6 shadow-xs">
              <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center shrink-0 border border-purple-100">
                    <Send className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base sm:text-lg font-bold text-slate-800">
                      {editingTaskId ? 'แก้ไขงานที่มอบหมาย' : 'มอบหมายงานวิชาการใหม่'}
                    </h2>
                    <p className="text-xs text-slate-400">
                      กำหนดรายละเอียดงานและวันสิ้นสุดกำหนดส่ง (DD/MM/YYYY)
                    </p>
                  </div>
                </div>

                {editingTaskId && (
                  <button
                    onClick={() => {
                      setEditingTaskId(null);
                      setTaskTitle('');
                      setTaskDescription('');
                    }}
                    className="text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 px-3 py-1.5 rounded-lg"
                  >
                    ยกเลิกการแก้ไข
                  </button>
                )}
              </div>

              <form onSubmit={handleSaveTask} className="space-y-4">
                <div className="space-y-4">
                  {/* Title */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">
                      ชื่อหัวข้องานที่มอบหมาย <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="เช่น ส่งแผนการจัดการเรียนรู้ ประจำภาคเรียนที่ 1/2569"
                      value={taskTitle}
                      onChange={(e) => setTaskTitle(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all outline-hidden"
                    />
                  </div>
                </div>

                {/* Description */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">
                    รายละเอียดคำอธิบายและแนวทางการส่งงาน
                  </label>
                  <textarea
                    rows={3}
                    placeholder="ระบุรูปแบบเอกสาร ไฟล์ที่ต้องการ หรือเงื่อนไขการส่งงาน..."
                    value={taskDescription}
                    onChange={(e) => setTaskDescription(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all outline-hidden"
                  />
                </div>

                {/* Due Date */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 flex items-center space-x-1.5">
                    <Calendar className="w-4 h-4 text-purple-600" />
                    <span>กำหนดส่ง (ปฏิทิน dd/mm/yyyy) *</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={taskDueDate}
                    onChange={(e) => setTaskDueDate(e.target.value)}
                    className="w-full max-w-sm px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all outline-hidden font-medium"
                  />
                  <p className="text-[11px] text-slate-400">
                    แสดงในปฏิทิน: {formatThaiDate(taskDueDate)}
                  </p>
                </div>

                {/* Submit button */}
                <div className="pt-2 flex justify-end">
                  <button
                    type="submit"
                    className="btn-glow-purple px-6 py-2.5 text-sm font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-xl transition-all cursor-pointer inline-flex items-center space-x-2"
                  >
                    <Check className="w-4 h-4" />
                    <span>{editingTaskId ? 'บันทึกการแก้ไขงาน' : 'ประกาศมอบหมายงาน'}</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Form 2: Announcement */}
          {adminMode === 'CREATE_ANNOUNCEMENT' && (
            <div className="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-6 shadow-xs">
              <div className="flex items-center space-x-3 pb-4 mb-4 border-b border-slate-100">
                <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center shrink-0 border border-amber-100">
                  <Megaphone className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-slate-800">
                    สร้างประกาศแจ้งเพื่อทราบ (Announcement)
                  </h2>
                  <p className="text-xs text-slate-400">
                    ไม่บังคับส่งงาน แต่จะแสดงแจ้งเตือนบนหน้า Dashboard และปฏิทิน (สีเหลือง)
                  </p>
                </div>
              </div>

              <form onSubmit={handleSaveAnnouncement} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-2 space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">
                      หัวข้อประกาศ / แจ้งกิจกรรม / วันหยุด <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="เช่น แจ้งกำหนดการประชุมวิชาการ หรือ แจ้งวันหยุดราชการ"
                      value={annTitle}
                      onChange={(e) => setAnnTitle(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all outline-hidden"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">ประเภทประกาศ</label>
                    <select
                      value={annType}
                      onChange={(e) => setAnnType(e.target.value as AnnouncementType)}
                      className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all outline-hidden font-medium"
                    >
                      <option value="ACTIVITY">🎯 กิจกรรม / การประชุม</option>
                      <option value="HOLIDAY">🏖️ วันหยุดราชการ</option>
                      <option value="ANNOUNCEMENT">📢 ข่าวสารทั่วไป</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">รายละเอียดประกาศ</label>
                  <textarea
                    rows={3}
                    placeholder="ระบุรายละเอียด กำหนดการ สถานที่ หรือสิ่งที่บุคลากรควรทราบ..."
                    value={annDetails}
                    onChange={(e) => setAnnDetails(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all outline-hidden"
                  />
                </div>

                <div className="space-y-1.5 max-w-sm">
                  <label className="text-xs font-bold text-slate-700 flex items-center space-x-1.5">
                    <Calendar className="w-4 h-4 text-amber-600" />
                    <span>วันที่เกิดกิจกรรม / วันหยุด (ปฏิทิน dd/mm/yyyy) *</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={annDate}
                    onChange={(e) => setAnnDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all outline-hidden font-medium"
                  />
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="submit"
                    className="btn-glow-amber px-6 py-2.5 text-sm font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl transition-all cursor-pointer inline-flex items-center space-x-2"
                  >
                    <Megaphone className="w-4 h-4" />
                    <span>เผยแพร่ประกาศแจ้งเพื่อทราบ</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* List of Current Assigned Tasks (Admin table view) */}
          <div className="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-6 shadow-xs">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-800">
                รายการงานที่มอบหมายแล้วทั้งหมด ({tasks.length} รายการ)
              </h2>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                    <th className="py-3 px-3 rounded-l-lg font-bold">หัวข้องาน</th>
                    <th className="py-3 px-3 font-bold">กำหนดส่ง (DD/MM/YYYY)</th>
                    <th className="py-3 px-3 font-bold">สถานะการส่ง</th>
                    <th className="py-3 px-3 rounded-r-lg font-bold text-right">การจัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {tasks.map((task) => {
                    const taskSubmissions = submissions.filter((s) => s.taskId === task.id);
                    return (
                      <tr key={task.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-3">
                          <p className="font-bold text-slate-800 line-clamp-1">{task.title}</p>
                          <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">
                            {task.description || 'ไม่มีคำอธิบาย'}
                          </p>
                        </td>
                        <td className="py-3.5 px-3 whitespace-nowrap font-medium text-slate-700">
                          {formatThaiDate(task.dueDate)}
                        </td>
                        <td className="py-3.5 px-3 whitespace-nowrap">
                          <span className="inline-flex items-center space-x-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>ส่งแล้ว {taskSubmissions.length} รายการ</span>
                          </span>
                        </td>
                        <td className="py-3.5 px-3 text-right whitespace-nowrap">
                          <div className="inline-flex items-center space-x-1">
                            <button
                              onClick={() => handleEditTask(task)}
                              className="p-1.5 text-slate-600 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors cursor-pointer"
                              title="แก้ไขงาน"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteTask(task.id)}
                              className="p-1.5 text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
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
          </div>

          {/* List of Announcements */}
          {announcements.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-xs">
              <h2 className="text-base font-bold text-slate-900 mb-3">
                รายการประกาศแจ้งเพื่อทราบทั้งหมด ({announcements.length} รายการ)
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {announcements.map((ann) => (
                  <div
                    key={ann.id}
                    className="p-4 rounded-xl border border-amber-200 bg-amber-50/40 flex items-start justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                          {ann.type === 'HOLIDAY'
                            ? '🏖️ วันหยุด'
                            : ann.type === 'ACTIVITY'
                            ? '🎯 กิจกรรม'
                            : '📢 ข่าวสาร'}
                        </span>
                        <span className="text-xs text-amber-800 font-medium">
                          {formatThaiDate(ann.date)}
                        </span>
                      </div>
                      <p className="text-sm font-bold text-slate-900">{ann.title}</p>
                      <p className="text-xs text-slate-600 line-clamp-2">{ann.details}</p>
                    </div>
                    <button
                      onClick={() => handleDeleteAnnouncement(ann.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors shrink-0"
                      title="ลบประกาศ"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ================= MEMBER VIEW ================= */}
      {!isAdmin && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-6 shadow-xs">
            <div className="flex items-center space-x-3 pb-4 mb-4 border-b border-slate-100">
              <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center shrink-0 border border-emerald-100">
                <Send className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-slate-800">
                  Academic Work Submission Form
                </h2>
                <p className="text-xs text-slate-400">
                  เลือกหัวข้องานที่ได้รับมอบหมาย อัปโหลดไฟล์งาน พร้อมส่งข้อมูลเข้าระบบ
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmitWork} className="space-y-5">
              {/* Task Selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">
                  1. เลือกงานหรือหัวข้อที่ได้รับมอบหมาย <span className="text-rose-500">*</span>
                </label>
                <select
                  value={selectedTaskId}
                  onChange={(e) => setSelectedTaskId(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all outline-hidden font-medium"
                >
                  {tasks.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title} (กำหนดส่ง: {formatThaiDate(t.dueDate)})
                    </option>
                  ))}
                </select>

                {/* Task Details and Due Date Warning */}
                {selectedTaskObj && (
                  <div className="mt-2 p-3.5 bg-slate-50/80 rounded-xl border border-slate-200 space-y-2">
                    <p className="text-xs text-slate-700">{selectedTaskObj.description}</p>
                    <div className="flex flex-wrap items-center gap-3 text-xs">
                      <div className="flex items-center space-x-1.5 text-slate-600">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>กำหนดส่ง: </span>
                        <strong className="text-slate-800">
                          {formatThaiDate(selectedTaskObj.dueDate)}
                        </strong>
                      </div>

                      {/* Late submission alert banner (as requested: ถ้ารูปแบบส่งช้ากว่ากำหนด ต้องแจ้งเตือนแต่ยังกดส่งได้) */}
                      {isPastDue(selectedTaskObj.dueDate) && (
                        <div className="inline-flex items-center space-x-1.5 text-rose-700 bg-rose-100/90 px-2.5 py-1 rounded-md font-bold text-xs">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>เลยกำหนดส่งแล้ว แต่ระบบยังเปิดให้ส่งงานได้</span>
                        </div>
                      )}

                      {existingSubmission && (
                        <div className="inline-flex items-center space-x-1 text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-md font-bold text-xs">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>คุณได้เคยส่งงานนี้แล้ว (สามารถอัปเดตไฟล์ใหม่ได้)</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Subject Title (Required) */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">
                  2. กรอกหัวข้องานที่ส่ง <span className="text-rose-500">* (บังคับ)</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="เช่น แผนการจัดการเรียนรู้วิชาภาษาไทย ม.2 ภาคเรียนที่ 1/2569"
                  value={submissionSubject}
                  onChange={(e) => setSubmissionSubject(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all outline-hidden"
                />
              </div>

              {/* Description (Optional) */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">
                  3. คำอธิบายเพิ่มเติม <span className="text-slate-400 font-normal">(ไม่บังคับ)</span>
                </label>
                <textarea
                  rows={2}
                  placeholder="เช่น แนบไฟล์บทเรียน 1-4 พร้อมแบบประเมินผลการเรียนรู้เรียบร้อยครับ"
                  value={submissionDescription}
                  onChange={(e) => setSubmissionDescription(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all outline-hidden"
                />
              </div>

              {/* Multi-File Upload Zone */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 flex items-center space-x-1.5">
                    <UploadCloud className="w-4 h-4 text-emerald-600" />
                    <span>4. อัปโหลดไฟล์งาน (รองรับ Multi-file Upload พร้อมกันหลายไฟล์/ภาพ)</span>
                  </label>
                  <span className="text-[11px] text-emerald-700 font-semibold bg-emerald-50 px-2.5 py-0.5 rounded-md border border-emerald-200">
                    ระบบ Cloud Storage
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
                  className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all cursor-pointer ${
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

                  <div className="flex flex-col items-center justify-center space-y-2">
                    <div className="p-3 bg-white rounded-full shadow-xs text-emerald-600">
                      <UploadCloud className="w-7 h-7 animate-pulse" />
                    </div>
                    <p className="text-sm font-bold text-slate-800">
                      คลิกเพื่อเลือกไฟล์ หรือลากไฟล์มาวางที่นี่
                    </p>
                    <p className="text-xs text-slate-500">
                      รองรับทุกนามสกุล: PDF, Word (.docx), Excel (.xlsx), PowerPoint (.pptx), รูปภาพ
                      (JPG/PNG), ZIP ฯลฯ
                    </p>
                  </div>
                </div>

                {/* Loading bar when uploading */}
                {isUploading && (
                  <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 flex items-center space-x-3">
                    <div className="w-4 h-4 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-xs font-semibold text-emerald-800">
                      กำลังประมวลผลและอัปโหลดไฟล์เข้าระบบ...
                    </p>
                  </div>
                )}

                {/* Uploaded Files List */}
                {uploadedFiles.length > 0 && (
                  <div className="space-y-2 mt-3">
                    <p className="text-xs font-bold text-slate-700">
                      รายการไฟล์ที่พร้อมส่ง ({uploadedFiles.length} ไฟล์):
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {uploadedFiles.map((file) => (
                        <div
                          key={file.id}
                          className="p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-between space-x-3 shadow-2xs hover:border-emerald-300 transition-colors"
                        >
                          <div className="flex items-center space-x-2.5 min-w-0">
                            {file.previewUrl ? (
                              <img
                                src={file.previewUrl}
                                alt="Preview"
                                className="w-9 h-9 rounded-lg object-cover ring-1 ring-slate-200"
                              />
                            ) : file.name.endsWith('.pdf') ? (
                              <div className="p-2 bg-rose-50 text-rose-600 rounded-lg">
                                <FileText className="w-5 h-5" />
                              </div>
                            ) : file.name.match(/\.(xlsx|xls|csv)$/) ? (
                              <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                                <FileSpreadsheet className="w-5 h-5" />
                              </div>
                            ) : (
                              <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
                                <File className="w-5 h-5" />
                              </div>
                            )}

                            <div className="min-w-0">
                              <p className="text-xs font-bold text-slate-800 truncate">
                                {file.name}
                              </p>
                              <p className="text-[11px] text-slate-500 font-mono">
                                {formatFileSize(file.size)}
                              </p>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRemoveFile(file.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
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

              {/* Submit CTA Button */}
              <div className="pt-3 border-t border-slate-100 flex justify-end">
                <button
                  type="submit"
                  className="btn-glow-emerald px-8 py-3 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-all cursor-pointer inline-flex items-center space-x-2 shadow-lg"
                >
                  <Send className="w-4 h-4" />
                  <span>
                    {existingSubmission ? 'อัปเดตงานที่ส่งแล้ว' : 'ยืนยันและส่งงานวิชาการ'}
                  </span>
                </button>
              </div>
            </form>
          </div>

          {/* Member's past submissions history */}
          <div className="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-6 shadow-xs">
            <h2 className="text-base font-bold text-slate-800 mb-3">
              ประวัติการส่งงานของคุณ ({submissions.filter((s) => s.memberId === currentUser?.id).length} รายการ)
            </h2>

            {submissions.filter((s) => s.memberId === currentUser?.id).length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">
                คุณยังไม่มีประวัติการส่งงานในระบบ
              </p>
            ) : (
              <div className="space-y-3">
                {submissions
                  .filter((s) => s.memberId === currentUser?.id)
                  .map((sub) => (
                    <div
                      key={sub.id}
                      className="p-4 rounded-2xl border border-slate-200/80 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                              sub.status === 'REVIEWED'
                                ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                : sub.status === 'NEEDS_REVISION'
                                ? 'bg-amber-100 text-amber-800 border-amber-300'
                                : 'bg-blue-100 text-blue-800 border-blue-200'
                            }`}
                          >
                            {sub.status === 'REVIEWED'
                              ? '✓ ตรวจแล้ว'
                              : sub.status === 'NEEDS_REVISION'
                              ? '⚠️ ให้แก้ไขเพิ่มเติม'
                              : 'รอดำเนินการตรวจ'}
                          </span>
                          <span className="text-xs text-slate-500">
                            ส่งเมื่อ: {new Date(sub.submittedAt).toLocaleString('th-TH')}
                          </span>
                        </div>
                        <p className="text-sm font-bold text-slate-900">{sub.subject}</p>
                        <p className="text-xs text-purple-700 font-medium">{sub.taskTitle}</p>
                        {sub.feedback && (
                          <div className="mt-1 p-2 bg-purple-50 rounded-lg border border-purple-200 text-xs text-purple-900">
                            <span className="font-bold">ข้อเสนอแนะจากผู้ตรวจ:</span> {sub.feedback}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center space-x-2">
                        <span className="text-xs text-slate-600 bg-white px-2.5 py-1 rounded-lg border border-slate-200">
                          {sub.files.length} ไฟล์แนบ
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

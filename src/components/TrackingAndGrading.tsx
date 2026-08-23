import React, { useState, useMemo } from 'react';
import {
  ClipboardCheck,
  CheckCircle2,
  AlertCircle,
  Download,
  MessageSquare,
  Sparkles,
  Search,
  Filter,
  FileText,
  FileSpreadsheet,
  File,
  Trash2,
  Edit3,
  ExternalLink,
  Star,
  Check,
  X,
  UserCheck,
  UserX,
  HardDrive,
} from 'lucide-react';
import {
  User,
  Task,
  Submission,
  SubmissionStatus,
  SubmissionFile,
} from '../types';
import {
  StorageService,
  GDRIVE_FOLDER_URL,
} from '../services/storage';
import {
  notifySuccess,
  notifyInfo,
  notifyError,
  confirmDialog,
} from '../services/notifications';

interface TrackingAndGradingProps {
  currentUser: User | null;
  tasks: Task[];
  submissions: Submission[];
  users: User[];
  onRefreshData: () => void;
}

const EMOJI_FEEDBACKS = [
  '🌟 ยอดเยี่ยมมาก สมบูรณ์แบบ',
  '👍 ผ่านเกณฑ์การประเมินดีเยี่ยม',
  '📝 มีจุดที่ควรปรับปรุงเพิ่มเติมเล็กน้อย',
  '🎯 ชิ้นงานตรงตามมาตรฐานตัวชี้วัด',
  '💡 มีนวัตกรรมและความคิดสร้างสรรค์น่าชื่นชม',
  '⚠️ ขอให้แก้ไขเอกสารและส่งใหม่อีกครั้ง',
];

export const TrackingAndGrading: React.FC<TrackingAndGradingProps> = ({
  currentUser,
  tasks,
  submissions,
  users,
  onRefreshData,
}) => {
  const isAdmin = currentUser?.role === 'ADMIN';

  // Filters
  const [selectedTaskId, setSelectedTaskId] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Review / Comment Modal
  const [reviewingSubmission, setReviewingSubmission] = useState<Submission | null>(null);
  const [feedbackText, setFeedbackText] = useState('');
  const [selectedEmoji, setSelectedEmoji] = useState(EMOJI_FEEDBACKS[0]);
  const [reviewStatus, setReviewStatus] = useState<SubmissionStatus>('REVIEWED');
  const [scoreVal, setScoreVal] = useState<number>(100);

  // Edit Submission Modal (for members or admin)
  const [editingSub, setEditingSub] = useState<Submission | null>(null);
  const [editSubject, setEditSubject] = useState('');
  const [editDesc, setEditDesc] = useState('');

  const activeMembers = useMemo(
    () => users.filter((u) => u.role === 'MEMBER' && u.status === 'ACTIVE'),
    [users]
  );

  // Statistics calculation
  const targetTasks = selectedTaskId === 'ALL' ? tasks : tasks.filter((t) => t.id === selectedTaskId);

  const stats = useMemo(() => {
    if (targetTasks.length === 0 || activeMembers.length === 0) {
      return { submittedCount: 0, totalExpected: 0, percentage: 0 };
    }

    if (selectedTaskId === 'ALL') {
      const totalExpected = targetTasks.length * activeMembers.length;
      const submittedCount = submissions.length;
      const percentage = Math.min(100, Math.round((submittedCount / (totalExpected || 1)) * 100));
      return { submittedCount, totalExpected, percentage };
    } else {
      const taskSubs = submissions.filter((s) => s.taskId === selectedTaskId);
      const totalExpected = activeMembers.length;
      const submittedCount = taskSubs.length;
      const percentage = Math.min(100, Math.round((submittedCount / (totalExpected || 1)) * 100));
      return { submittedCount, totalExpected, percentage };
    }
  }, [selectedTaskId, targetTasks, activeMembers, submissions]);

  // Filtered Submissions List
  const filteredSubmissions = useMemo(() => {
    return submissions.filter((sub) => {
      const matchTask = selectedTaskId === 'ALL' || sub.taskId === selectedTaskId;
      const matchSearch =
        sub.memberName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        sub.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
        sub.memberSchool.toLowerCase().includes(searchTerm.toLowerCase());
      const matchStatus = statusFilter === 'ALL' || sub.status === statusFilter;
      return matchTask && matchSearch && matchStatus;
    });
  }, [submissions, selectedTaskId, searchTerm, statusFilter]);

  // Members who haven't submitted for selected task
  const unsubmittedMembers = useMemo(() => {
    if (selectedTaskId === 'ALL') return [];
    const submittedMemberIds = new Set(
      submissions.filter((s) => s.taskId === selectedTaskId).map((s) => s.memberId)
    );
    return activeMembers.filter((m) => !submittedMemberIds.has(m.id));
  }, [selectedTaskId, activeMembers, submissions]);

  // Download simulation
  const handleDownloadFile = (file: SubmissionFile) => {
    notifyInfo(`กำลังเปิด/ดาวน์โหลดไฟล์ ${file.name}...`);

    // Direct download trigger:
    // If previewUrl is available (blob/base64), download directly
    if (file.previewUrl) {
      const a = document.createElement('a');
      a.href = file.previewUrl;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      notifySuccess(`ดาวน์โหลด ${file.name} เรียบร้อยแล้ว`);
      return;
    }

    // If Google Drive link exists, convert to direct download URL or open file directly
    if (file.gDriveUrl) {
      let downloadUrl = file.gDriveUrl;
      const fileIdMatch = file.gDriveUrl.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
      if (fileIdMatch && fileIdMatch[1] && !fileIdMatch[1].startsWith('sample')) {
        downloadUrl = `https://drive.google.com/uc?export=download&id=${fileIdMatch[1]}`;
      }
      window.open(downloadUrl, '_blank');
      notifySuccess(`เปิดดาวน์โหลดไฟล์ ${file.name} แล้ว`);
      return;
    }

    window.open(GDRIVE_FOLDER_URL, '_blank');
    notifySuccess(`เปิดลิงก์ดาวน์โหลด ${file.name} แล้ว`);
  };

  // Open Review Dialog (Admin)
  const handleOpenReview = (sub: Submission) => {
    setReviewingSubmission(sub);
    setFeedbackText(sub.feedback || '');
    setSelectedEmoji(sub.feedbackEmoji || EMOJI_FEEDBACKS[0]);
    setReviewStatus(sub.status === 'SUBMITTED' ? 'REVIEWED' : sub.status);
    setScoreVal(sub.score || 100);
  };

  // Save Review (Admin)
  const handleSaveReview = () => {
    if (!reviewingSubmission) return;

    StorageService.updateSubmission({
      ...reviewingSubmission,
      status: reviewStatus,
      feedback: feedbackText.trim(),
      feedbackEmoji: selectedEmoji,
      score: scoreVal,
      checkedBy: currentUser?.fullName || 'ผู้ดูแลระบบวิชาการ',
    });

    notifySuccess('บันทึกผลการตรวจและข้อเสนอแนะสำเร็จ');
    setReviewingSubmission(null);
    onRefreshData();
  };

  // Open Edit Submission Dialog
  const handleOpenEdit = (sub: Submission) => {
    // Only Admin or the owner can edit
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
    // Only Admin or the owner can delete
    if (!isAdmin && sub.memberId !== currentUser?.id) {
      notifyError('คุณไม่มีสิทธิ์ลบผลงานของผู้อื่น');
      return;
    }

    const ok = await confirmDialog(
      'ยืนยันการลบผลงานนี้?',
      'ไฟล์และผลการตรวจจะถูกลบออกจากระบบ'
    );
    if (ok) {
      StorageService.deleteSubmission(sub.id);
      notifySuccess('ลบรายการส่งงานสำเร็จ');
      onRefreshData();
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Progress Overview Card */}
      <div className="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center shrink-0 border border-blue-100">
              <ClipboardCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-800">
                {isAdmin
                  ? 'Task Tracking & Grading Center'
                  : 'Member Submission Tracker'}
              </h2>
              <p className="text-xs text-slate-400">
                {isAdmin
                  ? 'ตรวจสอบผลงานสมาชิก ให้ข้อเสนอแนะ และดาวน์โหลดไฟล์งาน'
                  : 'ดูสถานะการส่งงานของเพื่อนครู และดาวน์โหลดตัวอย่างผลงานมาศึกษาได้'}
              </p>
            </div>
          </div>

          {/* Controls: Task selector & Admin Google Drive button */}
          <div className="flex flex-wrap items-center gap-2">
            {isAdmin && (
              <a
                href={
                  selectedTaskId !== 'ALL'
                    ? tasks.find((t) => t.id === selectedTaskId)?.gDriveFolderUrl || GDRIVE_FOLDER_URL
                    : GDRIVE_FOLDER_URL
                }
                target="_blank"
                rel="noreferrer"
                className="px-3 py-2 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-xl transition-all inline-flex items-center space-x-1.5 shadow-2xs"
                title="เปิดโฟลเดอร์ Google Drive ของงานนี้"
              >
                <HardDrive className="w-4 h-4 text-emerald-600" />
                <span>Google Drive</span>
                <ExternalLink className="w-3 h-3 text-emerald-600" />
              </a>
            )}

            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold text-slate-600 whitespace-nowrap">เลือกหัวข้องาน:</span>
              <select
                value={selectedTaskId}
                onChange={(e) => setSelectedTaskId(e.target.value)}
                className="px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-hidden font-semibold text-slate-800 max-w-[200px] sm:max-w-xs truncate"
              >
                <option value="ALL">📌 ดูงานทุกหัวข้อทั้งหมด ({tasks.length} หัวข้อ)</option>
                {tasks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Visual Progress Dashboard Bar */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
          <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200/80 md:col-span-2">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="font-bold text-slate-700">ความก้าวหน้าการส่งงานโดยรวม</span>
              <span className="font-bold text-blue-700">{stats.percentage}%</span>
            </div>
            {/* Progress bar */}
            <div className="w-full bg-slate-200/80 rounded-full h-3 overflow-hidden p-0.5">
              <div
                className="bg-linear-to-r from-blue-500 via-indigo-500 to-purple-600 h-full rounded-full transition-all duration-500 shadow-xs"
                style={{ width: `${stats.percentage}%` }}
              ></div>
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-400 mt-2">
              <span>ส่งแล้ว: {stats.submittedCount} รายการ</span>
              <span>เป้าหมายทั้งหมด: {stats.totalExpected} รายการ</span>
            </div>
          </div>

          <div className="p-4 bg-blue-50/40 rounded-2xl border border-blue-200/80 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-blue-800">สมาชิกที่ตรวจงานแล้ว</p>
              <p className="text-2xl font-bold text-blue-900 mt-1">
                {submissions.filter((s) => s.status === 'REVIEWED').length}
                <span className="text-xs text-blue-600 font-normal"> / {submissions.length} งาน</span>
              </p>
            </div>
            <div className="w-10 h-10 bg-blue-600 text-white rounded-2xl flex items-center justify-center shrink-0 shadow-xs">
              <UserCheck className="w-5 h-5" />
            </div>
          </div>
        </div>
      </div>

      {/* Unsubmitted list (If single task selected) */}
      {selectedTaskId !== 'ALL' && unsubmittedMembers.length > 0 && (
        <div className="bg-rose-50/70 border border-rose-200 rounded-3xl p-4 shadow-xs">
          <div className="flex items-center space-x-2 text-xs font-bold text-rose-900 mb-2">
            <UserX className="w-4 h-4 text-rose-600" />
            <span>สมาชิกที่ยังไม่ได้ส่งงานหัวข้อนี้ ({unsubmittedMembers.length} ท่าน):</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {unsubmittedMembers.map((m) => (
              <span
                key={m.id}
                className="inline-flex items-center space-x-1.5 bg-white border border-rose-200 text-rose-800 px-3 py-1 rounded-full text-xs font-medium"
              >
                <img src={m.avatarUrl} alt="" className="w-4 h-4 rounded-full object-cover" />
                <span>{m.fullName}</span>
                <span className="text-[10px] text-slate-400">({m.school})</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Search & Filter Toolbar */}
      <div className="bg-white rounded-3xl border border-slate-200/80 p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="ค้นหาชื่อครู, หัวข้องาน, สังกัด..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3.5 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-hidden"
          />
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white outline-hidden font-medium text-slate-700"
          >
            <option value="ALL">สถานะทั้งหมด</option>
            <option value="SUBMITTED">รอดำเนินการตรวจ</option>
            <option value="REVIEWED">ตรวจแล้ว (ผ่าน)</option>
            <option value="NEEDS_REVISION">ให้แก้ไขเพิ่มเติม</option>
          </select>
        </div>
      </div>

      {/* Main Inspection Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-6 shadow-xs">
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
          <h2 className="text-base font-bold text-slate-800">
            ตารางรายการผลงานที่ส่งเข้ามา ({filteredSubmissions.length} รายการ)
          </h2>
          <span className="text-xs text-slate-400 font-medium">
            {selectedTaskId === 'ALL'
              ? 'แสดงทุกหัวข้องาน'
              : `หัวข้อ: ${tasks.find((t) => t.id === selectedTaskId)?.title || '-'}`}
          </span>
        </div>

        {filteredSubmissions.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <ClipboardCheck className="w-12 h-12 mx-auto mb-2 opacity-40" />
            <p className="text-sm font-semibold">ไม่พบรายการส่งงานตามเงื่อนไขที่เลือก</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                  <th className="py-3 px-3 rounded-l-lg font-bold">ผู้ส่งผลงาน</th>
                  <th className="py-3 px-3 font-bold">หัวข้องาน & งานที่มอบหมาย</th>
                  <th className="py-3 px-3 font-bold">ไฟล์งานแนบ</th>
                  <th className="py-3 px-3 font-bold">สถานะ & ข้อเสนอแนะ</th>
                  <th className="py-3 px-3 rounded-r-lg font-bold text-right">การจัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSubmissions.map((sub) => {
                  const isOwner = sub.memberId === currentUser?.id;
                  const canEdit = isAdmin || isOwner;

                  return (
                    <tr key={sub.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Member profile */}
                      <td className="py-4 px-3 align-top">
                        <div className="flex items-center space-x-2.5">
                          <img
                            src={sub.memberAvatar || 'https://api.dicebear.com/7.x/bottts/svg?seed=user'}
                            alt=""
                            className="w-8 h-8 rounded-full object-cover ring-1 ring-slate-200"
                          />
                          <div>
                            <p className="font-bold text-slate-800 leading-tight">
                              {sub.memberName}
                            </p>
                            <p className="text-[11px] text-slate-500 mt-0.5">{sub.memberSchool}</p>
                            <p className="text-[10px] text-slate-400 mt-0.5">
                              {new Date(sub.submittedAt).toLocaleString('th-TH')}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Subject & Task */}
                      <td className="py-4 px-3 align-top max-w-xs">
                        <p className="font-bold text-slate-900 leading-tight">{sub.subject}</p>
                        <span className="inline-block text-[11px] font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md mt-1 border border-purple-200">
                          {sub.taskTitle}
                        </span>
                        {sub.description && (
                          <p className="text-xs text-slate-600 mt-1 line-clamp-2">
                            {sub.description}
                          </p>
                        )}
                      </td>

                      {/* Files & Download Buttons (Every file type from Google Drive) */}
                      <td className="py-4 px-3 align-top">
                        <div className="space-y-1.5">
                          {sub.files.map((file) => (
                            <button
                              key={file.id}
                              onClick={() => handleDownloadFile(file)}
                              className="group w-full max-w-[200px] flex items-center justify-between p-1.5 bg-slate-50 hover:bg-purple-50 border border-slate-200 hover:border-purple-300 rounded-lg text-left transition-colors cursor-pointer"
                              title={`กดดาวน์โหลดไฟล์ ${file.name}`}
                            >
                              <div className="flex items-center space-x-1.5 min-w-0 pr-1">
                                {file.name.endsWith('.pdf') ? (
                                  <FileText className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                                ) : file.name.match(/\.(xlsx|xls)$/) ? (
                                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                                ) : (
                                  <File className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                                )}
                                <span className="text-xs text-slate-700 group-hover:text-purple-700 truncate">
                                  {file.name}
                                </span>
                              </div>
                              <Download className="w-3.5 h-3.5 text-slate-400 group-hover:text-purple-600 shrink-0" />
                            </button>
                          ))}
                        </div>
                      </td>

                      {/* Status & Feedback */}
                      <td className="py-4 px-3 align-top">
                        <div className="space-y-1.5">
                          <span
                            className={`inline-flex items-center space-x-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                              sub.status === 'REVIEWED'
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                : sub.status === 'NEEDS_REVISION'
                                ? 'bg-amber-50 text-amber-800 border-amber-300'
                                : 'bg-blue-50 text-blue-800 border-blue-200'
                            }`}
                          >
                            {sub.status === 'REVIEWED' ? (
                              <>
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                <span>ผ่านเกณฑ์ประเมิน ({sub.score || 100} คะแนน)</span>
                              </>
                            ) : sub.status === 'NEEDS_REVISION' ? (
                              <>
                                <AlertCircle className="w-3 h-3 text-amber-600" />
                                <span>ควรปรับปรุง</span>
                              </>
                            ) : (
                              <span>รอการตรวจ</span>
                            )}
                          </span>

                          {sub.feedbackEmoji && (
                            <p className="text-xs font-semibold text-purple-700">
                              {sub.feedbackEmoji}
                            </p>
                          )}

                          {sub.feedback && (
                            <p className="text-[11px] text-slate-600 bg-slate-100/70 p-2 rounded-lg border border-slate-200 line-clamp-2">
                              {sub.feedback}
                            </p>
                          )}
                        </div>
                      </td>

                      {/* Actions & Emoji Management */}
                      <td className="py-4 px-3 align-top text-right whitespace-nowrap">
                        <div className="inline-flex items-center space-x-1">
                          {/* Admin Review Button */}
                          {isAdmin && (
                            <button
                              onClick={() => handleOpenReview(sub)}
                              className="px-2.5 py-1.5 text-xs font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg transition-colors cursor-pointer flex items-center space-x-1"
                              title="ให้ข้อเสนอแนะและตรวจงาน"
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                              <span>ตรวจงาน</span>
                            </button>
                          )}

                          {/* Edit / Delete Emoji Buttons */}
                          {canEdit && (
                            <>
                              <button
                                onClick={() => handleOpenEdit(sub)}
                                className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                                title="✏️ แก้ไขข้อมูลงาน"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>

                              <button
                                onClick={() => handleDeleteSubmission(sub)}
                                className="p-1.5 text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                title="🗑️ ลบงานนี้"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
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

      {/* Admin Review / Feedback Modal */}
      {reviewingSubmission && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 relative animate-in fade-in zoom-in duration-200">
            <button
              onClick={() => setReviewingSubmission(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-3 mb-4">
              <div className="p-3 bg-purple-600 text-white rounded-xl shadow-xs">
                <Sparkles className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  ตรวจงานและให้ข้อเสนอแนะ (Feedback)
                </h2>
                <p className="text-xs text-slate-500">
                  สำหรับ: {reviewingSubmission.memberName} ({reviewingSubmission.subject})
                </p>
              </div>
            </div>

            <div className="space-y-4">
              {/* Status Selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">ผลการประเมิน</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setReviewStatus('REVIEWED')}
                    className={`py-2 px-3 text-xs font-bold rounded-xl border flex items-center justify-center space-x-1.5 cursor-pointer ${
                      reviewStatus === 'REVIEWED'
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-400 ring-2 ring-emerald-500/20'
                        : 'bg-slate-50 text-slate-600 border-slate-200'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>✓ ผ่านเกณฑ์ประเมิน</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setReviewStatus('NEEDS_REVISION')}
                    className={`py-2 px-3 text-xs font-bold rounded-xl border flex items-center justify-center space-x-1.5 cursor-pointer ${
                      reviewStatus === 'NEEDS_REVISION'
                        ? 'bg-amber-50 text-amber-800 border-amber-400 ring-2 ring-amber-500/20'
                        : 'bg-slate-50 text-slate-600 border-slate-200'
                    }`}
                  >
                    <AlertCircle className="w-4 h-4 text-amber-600" />
                    <span>⚠️ ควรปรับปรุงแก้ไข</span>
                  </button>
                </div>
              </div>

              {/* Quick Emoji Feedbacks */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">
                  ข้อความสติ๊กเกอร์ / Emoji ตอบกลับด่วน
                </label>
                <div className="grid grid-cols-1 gap-1.5 max-h-32 overflow-y-auto">
                  {EMOJI_FEEDBACKS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setSelectedEmoji(emoji)}
                      className={`text-left text-xs px-3 py-1.5 rounded-lg border transition-all cursor-pointer ${
                        selectedEmoji === emoji
                          ? 'bg-purple-100 text-purple-900 border-purple-300 font-bold'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              {/* Detailed Comments */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">ข้อเสนอแนะเพิ่มเติม</label>
                <textarea
                  rows={3}
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value)}
                  placeholder="เขียนคำแนะนำ คำชมเชย หรือข้อที่ต้องการให้แก้ไข..."
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-hidden"
                />
              </div>

              {/* Score */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">คะแนนประเมิน (เต็ม 100)</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={scoreVal}
                  onChange={(e) => setScoreVal(Number(e.target.value))}
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white outline-hidden font-bold"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={() => setReviewingSubmission(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleSaveReview}
                className="btn-glow-purple px-5 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-xl transition-all cursor-pointer"
              >
                บันทึกผลการตรวจ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Submission Modal */}
      {editingSub && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 relative">
            <button
              onClick={() => setEditingSub(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1"
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
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-hidden"
                />
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">คำอธิบายเพิ่มเติม</label>
                <textarea
                  rows={3}
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-hidden"
                />
              </div>
            </div>

            <div className="mt-5 flex justify-end space-x-2">
              <button
                onClick={() => setEditingSub(null)}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 rounded-xl"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleSaveEditSub}
                className="px-4 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl"
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

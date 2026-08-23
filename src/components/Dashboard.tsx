import React, { useState, useMemo } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  Megaphone,
  ArrowRight,
  Users,
  FileCheck,
  Award,
  Sparkles,
  ExternalLink,
  Info,
  X,
  Send,
} from 'lucide-react';
import { User, Task, Announcement, Submission, NavigationTab } from '../types';

interface DashboardProps {
  currentUser: User | null;
  tasks: Task[];
  announcements: Announcement[];
  submissions: Submission[];
  users: User[];
  onNavigateTab: (tab: NavigationTab) => void;
  onSelectTaskToSubmit?: (task: Task) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  currentUser,
  tasks,
  announcements,
  submissions,
  users,
  onNavigateTab,
  onSelectTaskToSubmit,
}) => {
  // Calendar state (defaults to current date 2026-08)
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [selectedCalendarItem, setSelectedCalendarItem] = useState<{
    type: 'TASK' | 'ANNOUNCEMENT';
    date: string;
    item: Task | Announcement;
    statusColor: 'RED' | 'GREEN' | 'YELLOW';
    statusText: string;
  } | null>(null);

  const isAdmin = currentUser?.role === 'ADMIN';
  const activeMembers = useMemo(() => users.filter((u) => u.role === 'MEMBER' && u.status === 'ACTIVE'), [users]);

  // Current year & month
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthNamesThai = [
    'มกราคม',
    'กุมภาพันธ์',
    'มีนาคม',
    'เมษายน',
    'พฤษภาคม',
    'มิถุนายน',
    'กรกฎาคม',
    'สิงหาคม',
    'กันยายน',
    'ตุลาคม',
    'พฤศจิกายน',
    'ธันวาคม',
  ];

  const daysOfWeekThai = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
  const fullDaysOfWeekThai = ['วันอาทิตย์', 'วันจันทร์', 'วันอังคาร', 'วันพุธ', 'วันพฤหัสบดี', 'วันศุกร์', 'วันเสาร์'];

  // Helper date formatter DD/MM/YYYY with Day of week prefix (e.g. จ.24/8/2569)
  const formatThaiDate = (dateStr: string, includeDayOfWeek: boolean = true) => {
    if (!dateStr) return '-';
    try {
      const [y, m, d] = dateStr.split('-');
      const parsedYear = parseInt(y, 10);
      const parsedMonth = parseInt(m, 10) - 1;
      const parsedDay = parseInt(d, 10);
      const thaiYear = parsedYear + 543;
      
      const dateObj = new Date(parsedYear, parsedMonth, parsedDay);
      const dayOfWeekIndex = dateObj.getDay();
      const shortDay = daysOfWeekThai[dayOfWeekIndex] || '';

      const dayClean = String(parsedDay);
      const monthClean = String(parsedMonth + 1);

      if (includeDayOfWeek && shortDay) {
        return `${shortDay} ${dayClean}/${monthClean}/${thaiYear}`;
      }
      return `${dayClean}/${monthClean}/${thaiYear}`;
    } catch {
      return dateStr;
    }
  };

  const isToday = (dateStr: string) => {
    const todayStr = new Date().toISOString().split('T')[0];
    return dateStr === todayStr;
  };

  const isPastDue = (dateStr: string) => {
    const todayStr = new Date().toISOString().split('T')[0];
    return dateStr < todayStr;
  };

  // Member-specific submission check
  const hasMemberSubmitted = (taskId: string, memberId?: string) => {
    if (!memberId) return false;
    return submissions.some((s) => s.taskId === taskId && s.memberId === memberId);
  };

  // Admin-specific check if all active members submitted
  const isTaskFullySubmittedByAll = (taskId: string) => {
    if (activeMembers.length === 0) return false;
    const submittedMemberIds = new Set(
      submissions.filter((s) => s.taskId === taskId).map((s) => s.memberId)
    );
    return activeMembers.every((m) => submittedMemberIds.has(m.id));
  };

  // Calendar days computation
  const calendarDays = useMemo(() => {
    const firstDayIndex = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();
    const prevMonthTotalDays = new Date(year, month, 0).getDate();

    const days = [];

    // Previous month filler days
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const dayNum = prevMonthTotalDays - i;
      const prevMonth = month === 0 ? 11 : month - 1;
      const prevYear = month === 0 ? year - 1 : year;
      const dateStr = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
      days.push({
        dayNum,
        dateStr,
        isCurrentMonth: false,
      });
    }

    // Current month days
    for (let i = 1; i <= totalDays; i++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      days.push({
        dayNum: i,
        dateStr,
        isCurrentMonth: true,
      });
    }

    // Next month filler days to complete grid (42 cells)
    const remainingCells = 42 - days.length;
    for (let i = 1; i <= remainingCells; i++) {
      const nextMonth = month === 11 ? 0 : month + 1;
      const nextYear = month === 11 ? year + 1 : year;
      const dateStr = `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      days.push({
        dayNum: i,
        dateStr,
        isCurrentMonth: false,
      });
    }

    return days;
  }, [year, month]);

  // Map events per date
  const eventsByDate = useMemo(() => {
    const map = new Map<
      string,
      Array<{
        type: 'TASK' | 'ANNOUNCEMENT';
        item: Task | Announcement;
        statusColor: 'RED' | 'GREEN' | 'YELLOW';
        statusText: string;
      }>
    >();

    // Announcements -> Always YELLOW
    announcements.forEach((ann) => {
      if (!map.has(ann.date)) map.set(ann.date, []);
      map.get(ann.date)!.push({
        type: 'ANNOUNCEMENT',
        item: ann,
        statusColor: 'YELLOW',
        statusText: 'ประกาศแจ้งเพื่อทราบ',
      });
    });

    // Tasks
    tasks.forEach((task) => {
      if (!map.has(task.dueDate)) map.set(task.dueDate, []);

      let statusColor: 'RED' | 'GREEN' | 'YELLOW' = 'RED';
      let statusText = 'มีงานต้องส่ง';

      if (isAdmin) {
        // For Admin: Green = All members submitted, Red = Not all submitted
        const isAllSubmitted = isTaskFullySubmittedByAll(task.id);
        if (isAllSubmitted) {
          statusColor = 'GREEN';
          statusText = 'สมาชิกส่งครบแล้ว';
        } else {
          statusColor = 'RED';
          statusText = 'ยังส่งไม่ครบทุกคน';
        }
      } else {
        // For Member: Green = Member submitted, Red = Not submitted
        const isSubmitted = hasMemberSubmitted(task.id, currentUser?.id);
        if (isSubmitted) {
          statusColor = 'GREEN';
          statusText = 'ส่งงานเรียบร้อยแล้ว';
        } else {
          statusColor = 'RED';
          statusText = isToday(task.dueDate)
            ? 'มีงานต้องส่งในวันนี้!'
            : isPastDue(task.dueDate)
            ? 'งานค้างส่ง (เลยกำหนด)'
            : 'ยังไม่ได้ส่งงาน';
        }
      }

      map.get(task.dueDate)!.push({
        type: 'TASK',
        item: task,
        statusColor,
        statusText,
      });
    });

    return map;
  }, [tasks, announcements, isAdmin, currentUser, activeMembers, submissions]);

  // Member Unsubmitted Tasks
  const memberPendingTasks = useMemo(() => {
    if (!currentUser || isAdmin) return [];
    return tasks.filter((t) => !hasMemberSubmitted(t.id, currentUser.id));
  }, [tasks, currentUser, isAdmin, submissions]);

  // Admin Pending Submissions Summary (Who hasn't submitted what)
  const adminPendingSummary = useMemo(() => {
    if (!isAdmin) return [];
    const list: Array<{
      task: Task;
      pendingMembers: User[];
      submittedCount: number;
    }> = [];

    tasks.forEach((task) => {
      const submittedIds = new Set(
        submissions.filter((s) => s.taskId === task.id).map((s) => s.memberId)
      );
      const notSubmittedMembers = activeMembers.filter((m) => !submittedIds.has(m.id));
      if (notSubmittedMembers.length > 0) {
        list.push({
          task,
          pendingMembers: notSubmittedMembers,
          submittedCount: submittedIds.size,
        });
      }
    });

    return list;
  }, [tasks, activeMembers, submissions, isAdmin]);

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const handleTodayMonth = () => {
    setCurrentDate(new Date());
  };

  return (
    <div className="space-y-6">
      {/* Top Banner: Active Announcements Alert */}
      {announcements.length > 0 && (
        <div className="bg-amber-50/90 border-2 border-amber-300 rounded-3xl p-5 sm:p-6 shadow-sm relative overflow-hidden">
          <div className="flex items-start space-x-4">
            <div className="w-12 h-12 bg-amber-500 text-white rounded-2xl flex items-center justify-center shadow-md shrink-0 ring-4 ring-amber-100">
              <Megaphone className="w-6 h-6" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1.5">
                <span className="text-xs font-bold text-amber-950 uppercase tracking-wider bg-amber-200/90 px-3 py-0.5 rounded-lg border border-amber-300">
                  📢 ประกาศด่วน / กิจกรรมสำคัญ
                </span>
                <span className="text-sm font-bold text-amber-900 bg-amber-100/80 px-3 py-0.5 rounded-lg border border-amber-200">
                  {formatThaiDate(announcements[0].date, true)}
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                {announcements[0].title}
              </h2>
              <p className="text-sm text-slate-700 mt-1 leading-relaxed font-normal">
                {announcements[0].details}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Stats Metric Cards (Geometric Balance Style) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Tasks */}
        <div className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-xs hover:shadow-md transition-all group">
          <div className="flex justify-between items-start">
            <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">
              Total Assigned
            </span>
            <span className="text-purple-600 bg-purple-50 text-[10px] px-2 py-0.5 rounded-md font-bold border border-purple-100">
              Active
            </span>
          </div>
          <div className="text-3xl font-bold text-slate-800 mt-2">{tasks.length}</div>
          <p className="text-[11px] text-slate-400 mt-0.5">รวมงานวิชาการประจำภาคเรียน</p>
          <div className="h-1.5 w-full bg-slate-100 rounded-full mt-4 overflow-hidden">
            <div className="h-full bg-purple-500 rounded-full w-full"></div>
          </div>
        </div>

        {/* Card 2: Submitted */}
        <div className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-xs hover:shadow-md transition-all group">
          <div className="flex justify-between items-start">
            <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">
              {isAdmin ? 'Total Submissions' : 'Your Submissions'}
            </span>
            <span className="text-emerald-600 bg-emerald-50 text-[10px] px-2 py-0.5 rounded-md font-bold border border-emerald-100">
              {isAdmin ? 'System Active' : 'Completed'}
            </span>
          </div>
          <div className="text-3xl font-bold text-emerald-600 mt-2">
            {isAdmin
              ? `${submissions.length}`
              : `${
                  submissions.filter((s) => s.memberId === currentUser?.id).length
                }`}
            <span className="text-sm font-normal text-slate-400 ml-1.5">
              / {tasks.length}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {isAdmin ? 'ผลงานทั้งหมดที่ส่งเข้าระบบ' : 'สถานะการส่งงานของคุณ'}
          </p>
          <div className="h-1.5 w-full bg-slate-100 rounded-full mt-4 overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all duration-500"
              style={{
                width: `${
                  tasks.length > 0
                    ? Math.min(
                        100,
                        Math.round(
                          ((isAdmin
                            ? submissions.length / Math.max(1, tasks.length * (activeMembers.length || 1))
                            : submissions.filter((s) => s.memberId === currentUser?.id).length /
                              Math.max(1, tasks.length)) *
                            100)
                        )
                      )
                    : 0
                }%`,
              }}
            ></div>
          </div>
        </div>

        {/* Card 3: Pending */}
        <div className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-xs hover:shadow-md transition-all group">
          <div className="flex justify-between items-start">
            <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">
              {isAdmin ? 'Pending Tasks' : 'Unsubmitted Tasks'}
            </span>
            <span className="text-rose-600 bg-rose-50 text-[10px] px-2 py-0.5 rounded-md font-bold border border-rose-100">
              Action Req.
            </span>
          </div>
          <div className="text-3xl font-bold text-rose-600 mt-2">
            {isAdmin ? `${adminPendingSummary.length}` : `${memberPendingTasks.length}`}
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {memberPendingTasks.some((t) => isPastDue(t.dueDate))
              ? '⚠️ มีงานเลยกำหนดส่ง'
              : 'ตรวจสอบกำหนดส่งตามปฏิทิน'}
          </p>
          <div className="h-1.5 w-full bg-slate-100 rounded-full mt-4 overflow-hidden">
            <div
              className="h-full bg-rose-500 rounded-full"
              style={{
                width: `${
                  tasks.length > 0
                    ? Math.min(
                        100,
                        Math.round(
                          ((isAdmin ? adminPendingSummary.length : memberPendingTasks.length) /
                            Math.max(1, tasks.length)) *
                            100
                        )
                      )
                    : 0
                }%`,
              }}
            ></div>
          </div>
        </div>

        {/* Card 4: Active Teachers */}
        <div className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-xs hover:shadow-md transition-all group">
          <div className="flex justify-between items-start">
            <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">
              Faculty Members
            </span>
            <span className="text-blue-600 bg-blue-50 text-[10px] px-2 py-0.5 rounded-md font-bold border border-blue-100">
              Verified
            </span>
          </div>
          <div className="text-3xl font-bold text-slate-800 mt-2">
            {activeMembers.length}
            <span className="text-sm font-normal text-slate-400 ml-1.5">ท่าน</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">สมาชิกที่ได้รับการอนุมัติใช้งาน</p>
          <div className="h-1.5 w-full bg-slate-100 rounded-full mt-4 overflow-hidden">
            <div className="h-full bg-blue-500 rounded-full w-full"></div>
          </div>
        </div>
      </div>

      {/* Main Calendar View Section */}
      <div className="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-6 shadow-xs">
        {/* Calendar Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center shrink-0 border border-purple-100">
              <CalendarIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-800">
                Academic Calendar & Schedule
              </h2>
              <p className="text-xs text-slate-400">
                แสดงหัวข้องานตามวันกำหนดส่ง (DD/MM/YYYY) และประกาศแจ้งเตือน
              </p>
            </div>
          </div>

          {/* Month Navigator Controls */}
          <div className="flex items-center space-x-2">
            <button
              onClick={handleTodayMonth}
              className="px-3 py-1.5 text-xs font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-xl transition-colors cursor-pointer"
            >
              วันนี้
            </button>
            <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl p-1">
              <button
                onClick={handlePrevMonth}
                className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-white rounded-lg transition-all cursor-pointer"
                title="เดือนก่อนหน้า"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-3 text-xs sm:text-sm font-bold text-slate-800 whitespace-nowrap min-w-[130px] text-center">
                {monthNamesThai[month]} {year + 543}
              </span>
              <button
                onClick={handleNextMonth}
                className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-white rounded-lg transition-all cursor-pointer"
                title="เดือนถัดไป"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Color Legend */}
        <div className="flex flex-wrap items-center gap-3 sm:gap-6 py-3 px-3.5 text-xs font-medium border border-slate-100 bg-slate-50/60 rounded-2xl my-3">
          <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Legend:</span>
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
            <span className="text-slate-600 text-xs">
              {isAdmin ? 'สีแดง = งานที่ยังส่งไม่ครบ' : 'สีแดง = มีงานต้องส่ง / งานค้าง'}
            </span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
            <span className="text-slate-600 text-xs">
              {isAdmin ? 'สีเขียว = สมาชิกทุกคนส่งครบแล้ว' : 'สีเขียว = ส่งงานแล้ว'}
            </span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
            <span className="text-slate-600 text-xs">สีเหลือง = ประกาศแจ้งเพื่อทราบ / วันสำคัญ</span>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
          {/* Day of Week Headers */}
          {daysOfWeekThai.map((day, idx) => (
            <div
              key={day}
              className={`text-center py-2 text-[11px] font-bold uppercase tracking-wider rounded-xl ${
                idx === 0
                  ? 'text-rose-600 bg-rose-50/60'
                  : idx === 6
                  ? 'text-purple-600 bg-purple-50/60'
                  : 'text-slate-500 bg-slate-50'
              }`}
            >
              {day}
            </div>
          ))}

          {/* Calendar Day Cells */}
          {calendarDays.map((cell, idx) => {
            const dayEvents = eventsByDate.get(cell.dateStr) || [];
            const isTodayCell = isToday(cell.dateStr);

            return (
              <div
                key={`${cell.dateStr}-${idx}`}
                className={`min-h-[90px] sm:min-h-[115px] p-2 rounded-2xl border transition-all flex flex-col justify-between ${
                  cell.isCurrentMonth
                    ? isTodayCell
                      ? 'bg-purple-50/50 border-purple-300 ring-2 ring-purple-400/20 shadow-xs'
                      : 'bg-white border-slate-200/80 hover:border-purple-200 hover:shadow-sm'
                    : 'bg-slate-50/50 border-slate-100 text-slate-300'
                }`}
              >
                {/* Date number */}
                <div className="flex items-center justify-between">
                  <span
                    className={`text-xs font-bold inline-flex items-center justify-center w-6 h-6 rounded-lg ${
                      isTodayCell
                        ? 'bg-purple-600 text-white shadow-xs'
                        : cell.isCurrentMonth
                        ? 'text-slate-700'
                        : 'text-slate-300'
                    }`}
                  >
                    {cell.dayNum}
                  </span>
                  {dayEvents.length > 0 && (
                    <span className="text-[10px] font-bold text-slate-400">
                      {dayEvents.length}
                    </span>
                  )}
                </div>

                {/* Event Tags inside the day */}
                <div className="space-y-1 mt-1 flex-1 overflow-y-auto max-h-[75px] scrollbar-thin">
                  {dayEvents.map((evt, eIdx) => {
                    const isRed = evt.statusColor === 'RED';
                    const isGreen = evt.statusColor === 'GREEN';
                    const isYellow = evt.statusColor === 'YELLOW';

                    const bgClass = isRed
                      ? 'bg-rose-50 border-rose-200 text-rose-800 hover:bg-rose-100'
                      : isGreen
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100'
                      : 'bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100';

                    const dotClass = isRed
                      ? 'bg-rose-500'
                      : isGreen
                      ? 'bg-emerald-500'
                      : 'bg-amber-500';

                    return (
                      <button
                        key={`${evt.item.id}-${eIdx}`}
                        onClick={() =>
                          setSelectedCalendarItem({
                            type: evt.type,
                            date: cell.dateStr,
                            item: evt.item,
                            statusColor: evt.statusColor,
                            statusText: evt.statusText,
                          })
                        }
                        className={`w-full text-left px-1.5 py-1 rounded-md border text-[11px] font-medium leading-tight truncate flex items-center space-x-1 transition-all cursor-pointer ${bgClass}`}
                        title={evt.item.title}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotClass}`}></span>
                        <span className="truncate">{evt.item.title}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom Section: Overdue / Pending Tasks List */}
      <div className="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-6 shadow-xs">
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center shrink-0 border border-rose-100">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800">
                {isAdmin
                  ? 'Pending Submissions Summary'
                  : 'Unsubmitted Academic Tasks'}
              </h2>
              <p className="text-xs text-slate-400">
                {isAdmin
                  ? 'ตรวจสอบรายชื่อครูที่ยังไม่ส่งงานเพื่อติดตามผล'
                  : 'หากส่งช้ากว่ากำหนดระบบจะแจ้งเตือน แต่ยังคงสามารถกดส่งงานได้'}
              </p>
            </div>
          </div>
        </div>

        {/* Member View: Pending tasks list */}
        {!isAdmin && (
          <div>
            {memberPendingTasks.length === 0 ? (
              <div className="text-center py-8 bg-slate-50/60 rounded-2xl border border-dashed border-slate-200">
                <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                <p className="text-sm font-bold text-slate-800">ยอดเยี่ยมมาก! ไม่มีงานค้างส่ง</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  คุณได้ส่งงานวิชาการที่ได้รับมอบหมายครบถ้วนทุกรายการแล้ว
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {memberPendingTasks.map((task) => {
                  const overdue = isPastDue(task.dueDate);
                  const today = isToday(task.dueDate);

                  return (
                    <div
                      key={task.id}
                      className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all ${
                        overdue
                          ? 'bg-rose-50/50 border-rose-200'
                          : today
                          ? 'bg-amber-50/50 border-amber-200'
                          : 'bg-white border-slate-200/80 hover:border-purple-200'
                      }`}
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center space-x-2">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                              overdue
                                ? 'bg-rose-100 text-rose-800 border-rose-300'
                                : today
                                ? 'bg-amber-100 text-amber-800 border-amber-300'
                                : 'bg-purple-100 text-purple-800 border-purple-200'
                            }`}
                          >
                            {overdue
                              ? '⚠️ เลยกำหนดส่งแล้ว'
                              : today
                              ? '🔥 กำหนดส่งวันนี้'
                              : 'รอดำเนินการ'}
                          </span>
                          <span className="text-xs font-semibold text-purple-700">
                            {task.category}
                          </span>
                        </div>
                        <h2 className="text-sm font-bold text-slate-900 line-clamp-1">
                          {task.title}
                        </h2>
                        <p className="text-xs text-slate-500 flex items-center space-x-2">
                          <Clock className="w-3.5 h-3.5" />
                          <span>กำหนดส่ง: {formatThaiDate(task.dueDate)}</span>
                          {overdue && (
                            <span className="text-rose-600 font-medium">
                              (ส่งล่าช้าได้ ระบบยังเปิดรับ)
                            </span>
                          )}
                        </p>
                      </div>

                      <button
                        onClick={() => {
                          if (onSelectTaskToSubmit) onSelectTaskToSubmit(task);
                          onNavigateTab('ASSIGN_SUBMIT');
                        }}
                        className="btn-glow-emerald shrink-0 inline-flex items-center justify-center space-x-1.5 px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-all cursor-pointer"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>กดส่งงานตอนนี้</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Admin View: Pending Members by Task */}
        {isAdmin && (
          <div>
            {adminPendingSummary.length === 0 ? (
              <div className="text-center py-8 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                <p className="text-sm font-bold text-slate-800">
                  ยินดีด้วย! สมาชิกทุกคนส่งงานครบทุกหัวข้อแล้ว
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  ไม่มีรายชื่อสมาชิกค้างส่งงานในระบบขณะนี้
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {adminPendingSummary.map(({ task, pendingMembers, submittedCount }) => (
                  <div
                    key={task.id}
                    className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <span className="text-xs font-semibold text-purple-700 bg-purple-100 px-2 py-0.5 rounded-md">
                          {task.category}
                        </span>
                        <h2 className="text-sm font-bold text-slate-900 mt-1">{task.title}</h2>
                        <p className="text-xs text-slate-500 flex items-center space-x-2 mt-0.5">
                          <Clock className="w-3.5 h-3.5" />
                          <span>กำหนดส่ง: {formatThaiDate(task.dueDate)}</span>
                          <span className="text-slate-300">|</span>
                          <span className="text-emerald-700 font-medium">
                            ส่งแล้ว {submittedCount} / {activeMembers.length} ท่าน
                          </span>
                        </p>
                      </div>

                      <button
                        onClick={() => onNavigateTab('TRACKING_REVIEW')}
                        className="text-xs font-semibold text-blue-700 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg border border-blue-200 transition-colors inline-flex items-center space-x-1 shrink-0"
                      >
                        <span>ไปหน้าตรวจงาน</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Member Avatars / Names who haven't submitted */}
                    <div className="bg-white p-3 rounded-lg border border-slate-200/80">
                      <p className="text-xs font-semibold text-rose-700 mb-2 flex items-center gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5" />
                        สมาชิกที่ยังไม่ได้ส่ง ({pendingMembers.length} ท่าน):
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {pendingMembers.map((m) => (
                          <div
                            key={m.id}
                            className="inline-flex items-center space-x-1.5 bg-rose-50 border border-rose-200 text-rose-800 px-2.5 py-1 rounded-full text-xs font-medium"
                          >
                            <img
                              src={m.avatarUrl}
                              alt={m.fullName}
                              className="w-4 h-4 rounded-full object-cover"
                            />
                            <span>{m.fullName}</span>
                            <span className="text-[10px] text-rose-600 font-normal">
                              ({m.school})
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Calendar Item Detail Modal */}
      {selectedCalendarItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 relative animate-in fade-in zoom-in duration-200">
            <button
              onClick={() => setSelectedCalendarItem(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-3 mb-4">
              <div
                className={`p-3 rounded-xl text-white ${
                  selectedCalendarItem.statusColor === 'RED'
                    ? 'bg-rose-500'
                    : selectedCalendarItem.statusColor === 'GREEN'
                    ? 'bg-emerald-500'
                    : 'bg-amber-500'
                }`}
              >
                {selectedCalendarItem.type === 'TASK' ? (
                  <FileCheck className="w-6 h-6" />
                ) : (
                  <Megaphone className="w-6 h-6" />
                )}
              </div>
              <div>
                <span
                  className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${
                    selectedCalendarItem.statusColor === 'RED'
                      ? 'bg-rose-100 text-rose-800 border-rose-300'
                      : selectedCalendarItem.statusColor === 'GREEN'
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                      : 'bg-amber-100 text-amber-800 border-amber-300'
                  }`}
                >
                  {selectedCalendarItem.statusText}
                </span>
                <p className="text-xs text-slate-500 mt-1">
                  วันที่: {formatThaiDate(selectedCalendarItem.date)}
                </p>
              </div>
            </div>

            <h2 className="text-base font-bold text-slate-900 leading-snug">
              {selectedCalendarItem.item.title}
            </h2>

            <div className="mt-3 p-3.5 bg-slate-50 rounded-xl border border-slate-100 text-xs text-slate-700 leading-relaxed max-h-48 overflow-y-auto">
              {'description' in selectedCalendarItem.item
                ? selectedCalendarItem.item.description
                : selectedCalendarItem.item.details}
            </div>

            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={() => setSelectedCalendarItem(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
              >
                ปิดหน้าต่าง
              </button>

              {selectedCalendarItem.type === 'TASK' && !isAdmin && (
                <button
                  onClick={() => {
                    const task = selectedCalendarItem.item as Task;
                    if (onSelectTaskToSubmit) onSelectTaskToSubmit(task);
                    setSelectedCalendarItem(null);
                    onNavigateTab('ASSIGN_SUBMIT');
                  }}
                  className="btn-glow-emerald px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-all cursor-pointer inline-flex items-center space-x-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>ไปหน้าส่งงานนี้</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

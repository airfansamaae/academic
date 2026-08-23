import React from 'react';
import {
  LayoutDashboard,
  Send,
  ClipboardCheck,
  FolderArchive,
  Sparkles,
  Users,
} from 'lucide-react';
import { NavigationTab, UserRole } from '../types';

interface SidebarProps {
  activeTab: NavigationTab;
  onTabChange: (tab: NavigationTab) => void;
  userRole?: UserRole;
  pendingReviewsCount?: number;
  pendingTasksCount?: number;
  pendingUsersCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onTabChange,
  userRole,
  pendingReviewsCount = 0,
  pendingTasksCount = 0,
  pendingUsersCount = 0,
}) => {
  const navItems = [
    {
      id: 'DASHBOARD' as NavigationTab,
      label: 'Dashboard',
      subLabel: 'ปฏิทินและภาพรวมงาน',
      iconEmoji: '📊',
      icon: LayoutDashboard,
      color: 'text-purple-600',
      activeBg: 'bg-purple-50 text-purple-700 border-purple-100 shadow-xs font-semibold',
      hoverGlow: 'hover:bg-slate-50 text-slate-600',
      badge: null,
    },
    {
      id: 'ASSIGN_SUBMIT' as NavigationTab,
      label: userRole === 'ADMIN' ? 'สั่งงาน & มอบหมายงาน' : 'ส่งงานตามที่มอบหมาย',
      subLabel: userRole === 'ADMIN' ? 'สร้างงานและประกาศ' : 'อัปโหลดงานส่งวิชาการ',
      iconEmoji: '📝',
      icon: Send,
      color: 'text-emerald-600',
      activeBg: 'bg-emerald-50 text-emerald-700 border-emerald-100 shadow-xs font-semibold',
      hoverGlow: 'hover:bg-slate-50 text-slate-600',
      badge: userRole === 'MEMBER' && pendingTasksCount > 0 ? `${pendingTasksCount} งานค้าง` : null,
      badgeColor: 'bg-amber-100 text-amber-800 border-amber-200',
    },
    {
      id: 'TRACKING_REVIEW' as NavigationTab,
      label: userRole === 'ADMIN' ? 'ติดตาม & ตรวจงาน' : 'ติดตามสถานะการส่งงาน',
      subLabel: userRole === 'ADMIN' ? 'ประเมินและให้ข้อเสนอแนะ' : 'ตรวจสอบสถานะเพื่อนและตนเอง',
      iconEmoji: '🔍',
      icon: ClipboardCheck,
      color: 'text-blue-600',
      activeBg: 'bg-blue-50 text-blue-700 border-blue-100 shadow-xs font-semibold',
      hoverGlow: 'hover:bg-slate-50 text-slate-600',
      badge: userRole === 'ADMIN' && pendingReviewsCount > 0 ? `${pendingReviewsCount} รอตรวจ` : null,
      badgeColor: 'bg-rose-100 text-rose-800 border-rose-200',
    },
    {
      id: 'DOCUMENT_CENTER' as NavigationTab,
      label: 'ศูนย์เอกสาร',
      subLabel: 'เอกสารตัวอย่าง & หนังสือคำสั่ง',
      iconEmoji: '📂',
      icon: FolderArchive,
      color: 'text-amber-600',
      activeBg: 'bg-amber-50 text-amber-800 border-amber-100 shadow-xs font-semibold',
      hoverGlow: 'hover:bg-slate-50 text-slate-600',
      badge: null,
      badgeColor: '',
    },
  ];

  return (
    <aside className="w-full lg:w-72 shrink-0 space-y-4">
      {/* Navigation Card */}
      <div className="bg-white rounded-3xl border border-slate-200/80 p-4 sm:p-5 shadow-xs">
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-purple-600" />
            Navigation Menu
          </span>
          <span className="text-[10px] font-bold text-purple-700 bg-purple-50 border border-purple-100 px-2 py-0.5 rounded-md">
            Academic 2569
          </span>
        </div>

        <nav className="space-y-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                id={`nav-tab-${item.id.toLowerCase()}`}
                onClick={() => onTabChange(item.id)}
                className={`w-full text-left p-3 rounded-2xl border transition-all flex items-center space-x-3 cursor-pointer relative group ${
                  isActive
                    ? item.activeBg
                    : 'bg-white border-transparent ' + item.hoverGlow
                }`}
              >
                <div
                  className={`w-9 h-9 rounded-xl shrink-0 flex items-center justify-center text-base transition-transform group-hover:scale-105 ${
                    isActive ? 'bg-white shadow-2xs' : 'bg-slate-50 text-slate-600'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${item.color}`} />
                </div>

                <div className="flex-1 min-w-0 pr-1">
                  <div className="flex items-center justify-between gap-1.5">
                    <p className="text-xs sm:text-sm font-semibold tracking-tight whitespace-nowrap overflow-hidden text-ellipsis">
                      {item.label}
                    </p>
                    {item.badge && (
                      <span
                        className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full border ${item.badgeColor}`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 font-normal mt-0.5 whitespace-nowrap overflow-hidden text-ellipsis">
                    {item.subLabel}
                  </p>
                </div>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Admin pending users hint if any */}
      {userRole === 'ADMIN' && pendingUsersCount > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-3xl p-4 shadow-2xs">
          <div className="flex items-center space-x-2 text-amber-900 font-bold text-xs">
            <Users className="w-4 h-4 text-amber-600" />
            <span>มีผู้รออนุมัติ ({pendingUsersCount} ท่าน)</span>
          </div>
          <p className="text-[11px] text-amber-700 mt-1">
            สามารถกดเมนู "Settings" มุมบนขวาเพื่อตรวจสอบและอนุมัติ
          </p>
        </div>
      )}
    </aside>
  );
};

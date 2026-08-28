import React from 'react';
import {
  LayoutDashboard,
  Send,
  ClipboardCheck,
  FolderArchive,
  Utensils,
} from 'lucide-react';
import { NavigationTab, UserRole } from '../types';

const LUNCH_SYSTEM_URL =
  'https://script.google.com/a/macros/krabiedu.go.th/s/AKfycbzgmOBgQ4534lIiTVuUikzaEF0PXofybzvaYZlXPvFeY4U8d3KrcpXZ-MsooaHSgIQ/exec';

interface MobileBottomNavProps {
  activeTab: NavigationTab;
  onTabChange: (tab: NavigationTab) => void;
  userRole?: UserRole;
  pendingTasksCount?: number;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  onTabChange,
  userRole,
  pendingTasksCount = 0,
}) => {
  const navItems = [
    {
      id: 'DASHBOARD' as NavigationTab,
      label: 'แดชบอร์ด',
      icon: LayoutDashboard,
      activeColor: 'text-purple-600',
      activeBg: 'bg-purple-50 text-purple-700 font-bold',
      badge: null,
    },
    {
      id: 'ASSIGN_SUBMIT' as NavigationTab,
      label: 'ส่งงาน',
      icon: Send,
      activeColor: 'text-emerald-600',
      activeBg: 'bg-emerald-50 text-emerald-700 font-bold',
      badge: userRole === 'MEMBER' && pendingTasksCount > 0 ? pendingTasksCount : null,
    },
    {
      id: 'TRACKING_REVIEW' as NavigationTab,
      label: 'ติดตามงาน',
      icon: ClipboardCheck,
      activeColor: 'text-blue-600',
      activeBg: 'bg-blue-50 text-blue-700 font-bold',
      badge: null,
    },
    {
      id: 'DOCUMENT_CENTER' as NavigationTab,
      label: 'ศูนย์เอกสาร',
      icon: FolderArchive,
      activeColor: 'text-amber-600',
      activeBg: 'bg-amber-50 text-amber-800 font-bold',
      badge: null,
    },
  ];

  return (
    <nav
      id="mobile-bottom-navigation"
      aria-label="Mobile Bottom Navigation"
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-xl px-1.5 py-1 safe-area-bottom flex items-center justify-around select-none"
    >
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = activeTab === item.id;

        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onTabChange(item.id)}
            className={`flex-1 py-1 px-1 flex flex-col items-center justify-center rounded-xl transition-all relative ${
              isActive
                ? item.activeBg
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
            }`}
          >
            <div className="relative">
              <Icon
                className={`w-5 h-5 transition-transform ${
                  isActive ? `${item.activeColor} scale-110` : 'text-slate-500'
                }`}
              />
              {item.badge !== null && (
                <span className="absolute -top-1 -right-2 bg-rose-500 text-white text-[9px] font-bold px-1 min-w-[15px] h-[15px] rounded-full flex items-center justify-center ring-1 ring-white">
                  {item.badge}
                </span>
              )}
            </div>
            <span
              className={`text-[10px] mt-0.5 tracking-tight truncate max-w-[62px] ${
                isActive ? 'font-bold' : 'font-normal'
              }`}
            >
              {item.label}
            </span>
          </button>
        );
      })}

      {/* อาหารกลางวัน (External Link) */}
      <a
        href={LUNCH_SYSTEM_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="flex-1 py-1 px-1 flex flex-col items-center justify-center rounded-xl text-slate-500 hover:text-orange-600 hover:bg-orange-50 transition-all"
        title="เปิดระบบอาหารกลางวัน"
      >
        <Utensils className="w-5 h-5 text-orange-500" />
        <span className="text-[10px] mt-0.5 tracking-tight truncate max-w-[62px] font-normal text-orange-700">
          อาหาร
        </span>
      </a>
    </nav>
  );
};

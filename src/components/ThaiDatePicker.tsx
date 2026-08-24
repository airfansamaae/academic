import React, { useState, useRef, useEffect } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Check } from 'lucide-react';

interface ThaiDatePickerProps {
  value: string; // ISO date 'YYYY-MM-DD'
  onChange: (dateStr: string) => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
  minDate?: string;
  className?: string;
  colorScheme?: 'purple' | 'amber' | 'rose' | 'emerald';
}

const thaiMonthNames = [
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

const daysOfWeek = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];

export const ThaiDatePicker: React.FC<ThaiDatePickerProps> = ({
  value,
  onChange,
  label,
  placeholder = 'วว/ดด/ปปปป (dd/mm/yyyy)',
  required = false,
  className = '',
  colorScheme = 'purple',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Parse initial date
  const parseDate = (val: string): Date => {
    if (!val) return new Date();
    const parts = val.split('-');
    if (parts.length === 3) {
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const d = parseInt(parts[2], 10);
      if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
        return new Date(y, m, d);
      }
    }
    return new Date();
  };

  const selectedDate = parseDate(value);
  const [viewYear, setViewYear] = useState<number>(selectedDate.getFullYear());
  const [viewMonth, setViewMonth] = useState<number>(selectedDate.getMonth());

  // Format value to DD/MM/YYYY
  const formatDisplayDate = (val: string) => {
    if (!val) return '';
    const parts = val.split('-');
    if (parts.length === 3) {
      const y = parts[0];
      const m = parts[1].padStart(2, '0');
      const d = parts[2].padStart(2, '0');
      const thaiYear = parseInt(y, 10) + 543;
      return `${d}/${m}/${y} (พ.ศ. ${thaiYear})`;
    }
    return val;
  };

  const [inputText, setInputText] = useState(formatDisplayDate(value));

  useEffect(() => {
    setInputText(formatDisplayDate(value));
    const d = parseDate(value);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  }, [value]);

  // Handle outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Calendar matrix calculation
  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (year: number, month: number) => {
    return new Date(year, month, 1).getDay();
  };

  const daysInCurrentMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDayIndex = getFirstDayOfMonth(viewYear, viewMonth);
  const daysInPrevMonth = getDaysInMonth(viewYear, viewMonth - 1);

  const prevMonthDays: number[] = [];
  for (let i = firstDayIndex - 1; i >= 0; i--) {
    prevMonthDays.push(daysInPrevMonth - i);
  }

  const currentMonthDays: number[] = [];
  for (let i = 1; i <= daysInCurrentMonth; i++) {
    currentMonthDays.push(i);
  }

  const totalGridCells = 42;
  const nextMonthDaysCount = totalGridCells - (prevMonthDays.length + currentMonthDays.length);
  const nextMonthDays: number[] = [];
  for (let i = 1; i <= nextMonthDaysCount; i++) {
    nextMonthDays.push(i);
  }

  const handlePrevMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };

  const handleNextMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  const handleSelectDay = (day: number) => {
    const yStr = String(viewYear);
    const mStr = String(viewMonth + 1).padStart(2, '0');
    const dStr = String(day).padStart(2, '0');
    const isoDate = `${yStr}-${mStr}-${dStr}`;
    onChange(isoDate);
    setIsOpen(false);
  };

  const handleSelectToday = (e: React.MouseEvent) => {
    e.stopPropagation();
    const today = new Date();
    const isoDate = today.toISOString().split('T')[0];
    onChange(isoDate);
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
    setIsOpen(false);
  };

  // Color schemes
  const colorStyles = {
    purple: {
      borderFocus: 'focus-within:border-purple-500 focus-within:ring-2 focus-within:ring-purple-500/20',
      activeDay: 'bg-purple-600 text-white font-bold shadow-xs',
      hoverDay: 'hover:bg-purple-50 hover:text-purple-700',
      iconColor: 'text-purple-600',
      badgeBg: 'bg-purple-50 text-purple-700',
    },
    amber: {
      borderFocus: 'focus-within:border-amber-500 focus-within:ring-2 focus-within:ring-amber-500/20',
      activeDay: 'bg-amber-600 text-white font-bold shadow-xs',
      hoverDay: 'hover:bg-amber-50 hover:text-amber-700',
      iconColor: 'text-amber-600',
      badgeBg: 'bg-amber-50 text-amber-700',
    },
    rose: {
      borderFocus: 'focus-within:border-rose-500 focus-within:ring-2 focus-within:ring-rose-500/20',
      activeDay: 'bg-rose-600 text-white font-bold shadow-xs',
      hoverDay: 'hover:bg-rose-50 hover:text-rose-700',
      iconColor: 'text-rose-600',
      badgeBg: 'bg-rose-50 text-rose-700',
    },
    emerald: {
      borderFocus: 'focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/20',
      activeDay: 'bg-emerald-600 text-white font-bold shadow-xs',
      hoverDay: 'hover:bg-emerald-50 hover:text-emerald-700',
      iconColor: 'text-emerald-600',
      badgeBg: 'bg-emerald-50 text-emerald-700',
    },
  }[colorScheme];

  const isSelected = (day: number) => {
    if (!value) return false;
    const parts = value.split('-');
    if (parts.length === 3) {
      return (
        parseInt(parts[0], 10) === viewYear &&
        parseInt(parts[1], 10) - 1 === viewMonth &&
        parseInt(parts[2], 10) === day
      );
    }
    return false;
  };

  const isTodayDate = (day: number) => {
    const today = new Date();
    return (
      today.getFullYear() === viewYear &&
      today.getMonth() === viewMonth &&
      today.getDate() === day
    );
  };

  return (
    <div className={`relative space-y-1 ${className}`} ref={containerRef}>
      {label && (
        <label className="text-xs font-bold text-slate-700 flex items-center space-x-1.5">
          <CalendarIcon className={`w-4 h-4 ${colorStyles.iconColor}`} />
          <span>{label}</span>
          {required && <span className="text-rose-500">*</span>}
        </label>
      )}

      {/* Input Display Button */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between cursor-pointer text-xs sm:text-sm font-semibold transition-all hover:bg-white ${colorStyles.borderFocus} shadow-2xs`}
      >
        <span className={value ? 'text-slate-800' : 'text-slate-400'}>
          {value ? formatDisplayDate(value) : placeholder}
        </span>
        <CalendarIcon className={`w-4 h-4 ${colorStyles.iconColor} shrink-0`} />
      </div>

      {/* Calendar Dropdown Popover */}
      {isOpen && (
        <div className="absolute z-50 mt-1 left-0 w-72 sm:w-80 bg-white rounded-2xl shadow-xl border border-slate-200 p-3.5 animate-in fade-in zoom-in-95 duration-150">
          {/* Header Controls */}
          <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-slate-100">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              title="เดือนก่อนหน้า"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="text-center">
              <span className="text-xs sm:text-sm font-bold text-slate-800">
                {thaiMonthNames[viewMonth]} {viewYear} (พ.ศ. {viewYear + 543})
              </span>
            </div>

            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              title="เดือนถัดไป"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Days of Week Header */}
          <div className="grid grid-cols-7 gap-1 text-center mb-1">
            {daysOfWeek.map((d, idx) => (
              <div
                key={d}
                className={`text-[11px] font-bold py-1 ${
                  idx === 0 ? 'text-rose-500' : idx === 6 ? 'text-purple-600' : 'text-slate-500'
                }`}
              >
                {d}
              </div>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1 text-center">
            {/* Prev month days */}
            {prevMonthDays.map((d) => (
              <div
                key={`prev-${d}`}
                className="py-1.5 text-xs text-slate-300 font-medium select-none"
              >
                {d}
              </div>
            ))}

            {/* Current month days */}
            {currentMonthDays.map((d) => {
              const active = isSelected(d);
              const today = isTodayDate(d);
              return (
                <button
                  key={`cur-${d}`}
                  type="button"
                  onClick={() => handleSelectDay(d)}
                  className={`py-1.5 text-xs rounded-lg transition-all cursor-pointer font-medium relative ${
                    active
                      ? colorStyles.activeDay
                      : `${colorStyles.hoverDay} text-slate-700 ${today ? 'font-bold underline decoration-2 decoration-purple-400' : ''}`
                  }`}
                >
                  {d}
                  {today && !active && (
                    <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 bg-purple-600 rounded-full"></span>
                  )}
                </button>
              );
            })}

            {/* Next month days */}
            {nextMonthDays.map((d) => (
              <div
                key={`next-${d}`}
                className="py-1.5 text-xs text-slate-300 font-medium select-none"
              >
                {d}
              </div>
            ))}
          </div>

          {/* Footer Quick Pick */}
          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={handleSelectToday}
              className="text-purple-600 hover:text-purple-700 font-bold hover:underline cursor-pointer"
            >
              เลือกวันนี้ ({new Date().getDate()}/{new Date().getMonth() + 1}/{new Date().getFullYear() + 543})
            </button>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-slate-500 hover:text-slate-700 font-semibold px-2 py-1 bg-slate-100 rounded-md hover:bg-slate-200 cursor-pointer"
            >
              ปิด
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

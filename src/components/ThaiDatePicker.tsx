import React, { useState, useRef, useEffect } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import {
  thaiMonthNamesFull,
  formatThaiDate,
  formatThaiDateRange,
  isDateWithinRange,
} from '../utils/dateHelpers';

export interface ThaiDatePickerProps {
  value: string; // ISO date 'YYYY-MM-DD' (Start date or single date)
  endDate?: string; // ISO date 'YYYY-MM-DD' (End date for range mode)
  onChange?: (dateStr: string) => void;
  onChangeRange?: (startDate: string, endDate: string) => void;
  allowRange?: boolean;
  label?: string;
  placeholder?: string;
  required?: boolean;
  minDate?: string;
  className?: string;
  colorScheme?: 'purple' | 'amber' | 'rose' | 'emerald';
}

const daysOfWeek = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];

export const ThaiDatePicker: React.FC<ThaiDatePickerProps> = ({
  value,
  endDate,
  onChange,
  onChangeRange,
  label,
  placeholder = 'วว/ดด/ปปปป (dd/mm/yyyy)',
  required = false,
  className = '',
  colorScheme = 'purple',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Click tracking for two-click selection:
  // 1st click sets pendingFirstDate.
  // 2nd click on same date => Single Day.
  // 2nd click on different date => Date Range (startDate..endDate).
  const [pendingFirstDate, setPendingFirstDate] = useState<string | null>(null);

  // Parse date for calendar initial view
  const parseDate = (val: string): Date => {
    if (!val || typeof val !== 'string') return new Date();
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

  const initialViewDate = parseDate(value || new Date().toISOString().split('T')[0]);
  const [viewYear, setViewYear] = useState<number>(initialViewDate.getFullYear());
  const [viewMonth, setViewMonth] = useState<number>(initialViewDate.getMonth());

  // Handle outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setPendingFirstDate(null);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Reset pending state when picker opens
  const handleToggleOpen = () => {
    if (!isOpen) {
      setPendingFirstDate(null);
      const activeDate = parseDate(value || new Date().toISOString().split('T')[0]);
      setViewYear(activeDate.getFullYear());
      setViewMonth(activeDate.getMonth());
    }
    setIsOpen(!isOpen);
  };

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

  // Smart Date Click Handler:
  // - 1st click: selects starting date
  // - 2nd click on SAME date: selects single date and closes
  // - 2nd click on ANOTHER date: selects date range and closes
  const handleSelectDay = (day: number) => {
    const yStr = String(viewYear);
    const mStr = String(viewMonth + 1).padStart(2, '0');
    const dStr = String(day).padStart(2, '0');
    const isoDate = `${yStr}-${mStr}-${dStr}`;

    if (!pendingFirstDate) {
      // First click: Record starting point
      setPendingFirstDate(isoDate);
    } else {
      // Second click:
      if (pendingFirstDate === isoDate) {
        // Clicked same date twice -> Single date
        if (onChange) onChange(isoDate);
        if (onChangeRange) onChangeRange(isoDate, isoDate);
      } else {
        // Clicked different date -> Date range
        let start = pendingFirstDate;
        let end = isoDate;
        if (start > end) {
          const tmp = start;
          start = end;
          end = tmp;
        }
        if (onChangeRange) {
          onChangeRange(start, end);
        } else if (onChange) {
          onChange(start);
        }
      }
      setPendingFirstDate(null);
      setIsOpen(false);
    }
  };

  const handleSelectToday = (e: React.MouseEvent) => {
    e.stopPropagation();
    const today = new Date();
    const isoDate = today.toISOString().split('T')[0];
    if (onChange) onChange(isoDate);
    if (onChangeRange) onChangeRange(isoDate, isoDate);
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
    setPendingFirstDate(null);
    setIsOpen(false);
  };

  // Color schemes
  const colorStyles = {
    purple: {
      borderFocus: 'focus-within:border-purple-500 focus-within:ring-2 focus-within:ring-purple-500/20',
      activeDay: 'bg-purple-600 text-white font-bold shadow-xs',
      inRangeDay: 'bg-purple-100/90 text-purple-900 font-semibold',
      hoverDay: 'hover:bg-purple-50 hover:text-purple-700',
      iconColor: 'text-purple-600',
      badgeBg: 'bg-purple-50 text-purple-700 border-purple-200',
    },
    amber: {
      borderFocus: 'focus-within:border-amber-500 focus-within:ring-2 focus-within:ring-amber-500/20',
      activeDay: 'bg-amber-600 text-white font-bold shadow-xs',
      inRangeDay: 'bg-amber-100/90 text-amber-900 font-semibold',
      hoverDay: 'hover:bg-amber-50 hover:text-amber-700',
      iconColor: 'text-amber-600',
      badgeBg: 'bg-amber-50 text-amber-700 border-amber-200',
    },
    rose: {
      borderFocus: 'focus-within:border-rose-500 focus-within:ring-2 focus-within:ring-rose-500/20',
      activeDay: 'bg-rose-600 text-white font-bold shadow-xs',
      inRangeDay: 'bg-rose-100/90 text-rose-900 font-semibold',
      hoverDay: 'hover:bg-rose-50 hover:text-rose-700',
      iconColor: 'text-rose-600',
      badgeBg: 'bg-rose-50 text-rose-700 border-rose-200',
    },
    emerald: {
      borderFocus: 'focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/20',
      activeDay: 'bg-emerald-600 text-white font-bold shadow-xs',
      inRangeDay: 'bg-emerald-100/90 text-emerald-900 font-semibold',
      hoverDay: 'hover:bg-emerald-50 hover:text-emerald-700',
      iconColor: 'text-emerald-600',
      badgeBg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    },
  }[colorScheme];

  const checkDayStatus = (day: number) => {
    const yStr = String(viewYear);
    const mStr = String(viewMonth + 1).padStart(2, '0');
    const dStr = String(day).padStart(2, '0');
    const isoDate = `${yStr}-${mStr}-${dStr}`;

    const today = new Date();
    const isToday =
      today.getFullYear() === viewYear &&
      today.getMonth() === viewMonth &&
      today.getDate() === day;

    if (pendingFirstDate) {
      const isStart = isoDate === pendingFirstDate;
      return {
        isSelected: isStart,
        isInRange: false,
        isEndpoint: isStart,
        isToday,
      };
    }

    const isRange = Boolean(endDate && endDate !== value);
    if (!isRange) {
      const isSelected = value === isoDate;
      return { isSelected, isInRange: false, isEndpoint: isSelected, isToday };
    }

    const start = value;
    const end = endDate || value;
    const isStart = isoDate === start;
    const isEnd = isoDate === end;
    const isInRange = isDateWithinRange(isoDate, start, end);

    return {
      isSelected: isStart || isEnd,
      isInRange: isInRange && !isStart && !isEnd,
      isEndpoint: isStart || isEnd,
      isStart,
      isEnd,
      isToday,
    };
  };

  const isRange = Boolean(endDate && endDate !== value);
  const displayText = isRange
    ? formatThaiDateRange(value, endDate || value)
    : formatThaiDate(value);

  return (
    <div className={`relative space-y-1.5 ${className}`} ref={containerRef}>
      {/* Label */}
      {label && (
        <label className="text-xs font-bold text-slate-700 flex items-center space-x-1.5">
          <CalendarIcon className={`w-4 h-4 ${colorStyles.iconColor}`} />
          <span>{label}</span>
          {required && <span className="text-rose-500">*</span>}
        </label>
      )}

      {/* Input Display Button */}
      <div
        onClick={handleToggleOpen}
        className={`w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between cursor-pointer text-xs sm:text-sm font-semibold transition-all hover:bg-white ${colorStyles.borderFocus} shadow-2xs`}
      >
        <div className="flex items-center space-x-2 truncate">
          <span className={value ? 'text-slate-800 font-bold' : 'text-slate-400'}>
            {value ? displayText : placeholder}
          </span>
          {isRange && (
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${colorStyles.badgeBg}`}>
              ช่วงวันที่
            </span>
          )}
        </div>
        <div className="flex items-center space-x-1.5 shrink-0">
          <CalendarIcon className={`w-4 h-4 ${colorStyles.iconColor}`} />
        </div>
      </div>

      {/* Calendar Dropdown Popover */}
      {isOpen && (
        <div className="absolute z-50 mt-1 left-0 w-80 sm:w-88 bg-white rounded-2xl shadow-2xl border border-slate-200 p-3.5 animate-in fade-in zoom-in-95 duration-150">
          {/* Smart Selection Guide Header */}
          <div className="mb-2.5 p-2 rounded-xl bg-slate-50 border border-slate-200/80 text-[11px] leading-relaxed">
            {pendingFirstDate ? (
              <div className="flex items-center justify-between font-bold text-purple-800">
                <span>
                  เลือกวันแรก: {formatThaiDate(pendingFirstDate)}
                </span>
                <span className="text-[10px] text-slate-500 font-normal">
                  กดวันที่เดิมซ้ำ = วันเดียว | กดวันอื่น = ช่วงวัน
                </span>
              </div>
            ) : (
              <div className="text-slate-600 flex items-center space-x-1">
                <Sparkles className="w-3 h-3 text-purple-600 shrink-0" />
                <span>
                  กดวันที่เดิม 2 ครั้ง = วันเดียว • กด 2 วันต่างกัน = ช่วงวันที่
                </span>
              </div>
            )}
          </div>

          {/* Month & Year Controls */}
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
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
                {thaiMonthNamesFull[viewMonth]} {viewYear} (พ.ศ. {viewYear + 543})
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
              const status = checkDayStatus(d);
              return (
                <button
                  key={`cur-${d}`}
                  type="button"
                  onClick={() => handleSelectDay(d)}
                  className={`py-1.5 text-xs transition-all cursor-pointer font-medium relative ${
                    status.isEndpoint
                      ? `${colorStyles.activeDay} rounded-lg`
                      : status.isInRange
                      ? `${colorStyles.inRangeDay} rounded-none`
                      : `${colorStyles.hoverDay} text-slate-700 rounded-lg ${
                          status.isToday ? 'font-bold underline decoration-2 decoration-purple-400' : ''
                        }`
                  }`}
                >
                  {d}
                  {status.isToday && !status.isEndpoint && (
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
          <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={handleSelectToday}
              className="text-purple-600 hover:text-purple-700 font-bold hover:underline cursor-pointer"
            >
              เลือกวันนี้ ({new Date().getDate()}/{new Date().getMonth() + 1}/{new Date().getFullYear() + 543})
            </button>
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                setPendingFirstDate(null);
              }}
              className="text-slate-500 hover:text-slate-700 font-semibold px-2.5 py-1 bg-slate-100 rounded-md hover:bg-slate-200 cursor-pointer"
            >
              ปิด
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

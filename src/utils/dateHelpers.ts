export const thaiMonthNamesFull = [
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

export const thaiMonthNamesShort = [
  'ม.ค.',
  'ก.พ.',
  'มี.ค.',
  'เม.ย.',
  'พ.ค.',
  'มิ.ย.',
  'ก.ค.',
  'ส.ค.',
  'ก.ย.',
  'ต.ค.',
  'พ.ย.',
  'ธ.ค.',
];

export const daysOfWeekThaiFull = [
  'วันอาทิตย์',
  'วันจันทร์',
  'วันอังคาร',
  'วันพุธ',
  'วันพฤหัสบดี',
  'วันศุกร์',
  'วันเสาร์',
];

export const daysOfWeekThaiShort = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];

/**
 * Format single ISO Date (YYYY-MM-DD) to Thai date string
 */
export function formatThaiDate(dateStr?: string, includeDay = false, format: 'short' | 'full' = 'short'): string {
  if (!dateStr || typeof dateStr !== 'string') return '-';
  try {
    const parts = dateStr.split('-');
    if (parts.length < 3) return dateStr;

    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    if (isNaN(y) || isNaN(m) || isNaN(d)) return dateStr;

    const thaiYear = y + 543;
    const dateObj = new Date(y, m, d);
    const dayOfWeekIndex = dateObj.getDay();
    const dayName = includeDay
      ? format === 'full'
        ? daysOfWeekThaiFull[dayOfWeekIndex]
        : daysOfWeekThaiShort[dayOfWeekIndex]
      : '';

    if (format === 'full') {
      const monthName = thaiMonthNamesFull[m] || '';
      return `${dayName ? `${dayName}ที่ ` : ''}${d} ${monthName} พ.ศ. ${thaiYear}`;
    }

    const dClean = String(d).padStart(2, '0');
    const mClean = String(m + 1).padStart(2, '0');
    if (includeDay && dayName) {
      return `${dayName} ${dClean}/${mClean}/${y} (พ.ศ. ${thaiYear})`;
    }
    return `${dClean}/${mClean}/${y} (พ.ศ. ${thaiYear})`;
  } catch {
    return dateStr || '-';
  }
}

/**
 * Format Date Range (Start Date - End Date) to elegant Thai representation
 * e.g.,
 * - "1 - 3 ก.ย. 2569 (3 วัน)"
 * - "30 ส.ค. - 2 ก.ย. 2569 (4 วัน)"
 * - "28/08/2026 (พ.ศ. 2569)" (If 1 day)
 */
export function formatThaiDateRange(
  startDate?: string,
  endDate?: string,
  includeDay = false
): string {
  if (!startDate && !endDate) return '-';
  const start = startDate || endDate || '';
  const end = endDate || startDate || '';

  if (!end || start === end) {
    return formatThaiDate(start, includeDay);
  }

  try {
    const startParts = start.split('-').map(Number);
    const endParts = end.split('-').map(Number);

    if (startParts.length < 3 || endParts.length < 3) {
      return `${start} - ${end}`;
    }

    const [sy, sm, sd] = startParts;
    const [ey, em, ed] = endParts;

    const startDateObj = new Date(sy, sm - 1, sd);
    const endDateObj = new Date(ey, em - 1, ed);

    // Calculate total days inclusive
    const diffMs = endDateObj.getTime() - startDateObj.getTime();
    const totalDays = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1);

    const sThaiYear = sy + 543;
    const eThaiYear = ey + 543;
    const sMonthShort = thaiMonthNamesShort[sm - 1] || '';
    const eMonthShort = thaiMonthNamesShort[em - 1] || '';

    let rangeText = '';
    if (sy === ey && sm === em) {
      // Same month & year: "1 - 3 ก.ย. 2569"
      rangeText = `${sd} - ${ed} ${eMonthShort} ${eThaiYear}`;
    } else if (sy === ey) {
      // Same year, different month: "30 ส.ค. - 2 ก.ย. 2569"
      rangeText = `${sd} ${sMonthShort} - ${ed} ${eMonthShort} ${eThaiYear}`;
    } else {
      // Different year: "30 ธ.ค. 2569 - 2 ม.ค. 2570"
      rangeText = `${sd} ${sMonthShort} ${sThaiYear} - ${ed} ${eMonthShort} ${eThaiYear}`;
    }

    return `${rangeText} (${totalDays} วัน)`;
  } catch {
    return `${start} - ${end}`;
  }
}

/**
 * Returns an array of all ISO date strings (YYYY-MM-DD) within [startDate, endDate] inclusive.
 */
export function getDatesInRange(startDate: string, endDate?: string): string[] {
  if (!startDate) return [];
  if (!endDate || startDate === endDate) return [startDate];

  try {
    const sParts = startDate.split('-').map(Number);
    const eParts = endDate.split('-').map(Number);
    if (sParts.length < 3 || eParts.length < 3) return [startDate];

    let cur = new Date(sParts[0], sParts[1] - 1, sParts[2]);
    const end = new Date(eParts[0], eParts[1] - 1, eParts[2]);

    if (cur.getTime() > end.getTime()) {
      // Swap if start is after end
      const temp = cur;
      cur = end;
      end.setTime(temp.getTime());
    }

    const dates: string[] = [];
    let count = 0;
    // Cap at 366 days for security
    while (cur.getTime() <= end.getTime() && count < 366) {
      const y = cur.getFullYear();
      const m = String(cur.getMonth() + 1).padStart(2, '0');
      const d = String(cur.getDate()).padStart(2, '0');
      dates.push(`${y}-${m}-${d}`);
      cur.setDate(cur.getDate() + 1);
      count++;
    }
    return dates.length > 0 ? dates : [startDate];
  } catch {
    return [startDate];
  }
}

/**
 * Check if a given date is within [startDate, endDate]
 */
export function isDateWithinRange(checkDate: string, startDate?: string, endDate?: string): boolean {
  if (!checkDate) return false;
  const start = startDate || endDate;
  const end = endDate || startDate;
  if (!start && !end) return false;
  if (start && !end) return checkDate === start;
  if (!start && end) return checkDate === end;
  return checkDate >= (start as string) && checkDate <= (end as string);
}

/**
 * Check if date or date range has passed compared to today
 */
export function isRangePastDue(endDate?: string, startDate?: string): boolean {
  const targetDateStr = endDate || startDate;
  if (!targetDateStr) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const parts = targetDateStr.split('-').map(Number);
  if (parts.length < 3) return false;
  const target = new Date(parts[0], parts[1] - 1, parts[2]);
  target.setHours(0, 0, 0, 0);
  return target.getTime() < today.getTime();
}

/**
 * Calculate difference in days relative to today
 */
export function getRangeDiffDays(startDate?: string, endDate?: string): {
  diffDays: number; // 0 if today is within range, >0 if upcoming, <0 if past
  status: 'TODAY_OR_ACTIVE' | 'UPCOMING' | 'PAST';
  totalDays: number;
} {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const startStr = startDate || endDate || '';
  const endStr = endDate || startDate || '';

  if (!startStr) return { diffDays: 0, status: 'TODAY_OR_ACTIVE', totalDays: 1 };

  const sParts = startStr.split('-').map(Number);
  const eParts = endStr.split('-').map(Number);

  const sDate = new Date(sParts[0], sParts[1] - 1, sParts[2]);
  sDate.setHours(0, 0, 0, 0);
  const eDate = new Date(eParts[0], eParts[1] - 1, eParts[2]);
  eDate.setHours(0, 0, 0, 0);

  const diffMsTotal = eDate.getTime() - sDate.getTime();
  const totalDays = Math.max(1, Math.round(diffMsTotal / (1000 * 60 * 60 * 24)) + 1);

  if (today.getTime() >= sDate.getTime() && today.getTime() <= eDate.getTime()) {
    return { diffDays: 0, status: 'TODAY_OR_ACTIVE', totalDays };
  }

  if (today.getTime() < sDate.getTime()) {
    const diffDays = Math.ceil((sDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return { diffDays, status: 'UPCOMING', totalDays };
  }

  const diffDays = Math.floor((eDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  return { diffDays, status: 'PAST', totalDays };
}

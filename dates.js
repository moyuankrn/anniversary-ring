const DAY = 86400000;
const pad = n => String(n).padStart(2, '0');

export function localToday(now = new Date()) {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function parseDay(day) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const [year, month, date] = day.split('-').map(Number);
  const value = Date.UTC(year, month - 1, date);
  const parsed = new Date(value);
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === date ? value : null;
}

function daysInMonth(year, month) {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

function occurrence(year, month, day) {
  return Date.UTC(year, month, Math.min(day, daysInMonth(year, month)));
}

export function eventStatus(event, todayString = localToday()) {
  const start = parseDay(event.date);
  const today = parseDay(todayString);
  if (start === null || today === null) throw new Error('Invalid date');
  const original = new Date(start);
  const current = new Date(today);
  const firstDay = original.getUTCDate();
  const elapsed = Math.round((today - start) / DAY);
  if (event.repeat === 'once') return {
    next: elapsed <= 0 ? start : null,
    daysLeft: elapsed <= 0 ? -elapsed : null,
    daysSince: elapsed > 0 ? elapsed : null,
    count: 0, progress: null,
  };
  if (!['monthly', 'yearly'].includes(event.repeat)) throw new Error('Invalid repeat');
  if (today < start) return { next: start, daysLeft: -elapsed, daysSince: null, count: 0, progress: 0 };

  let year = current.getUTCFullYear();
  let month = event.repeat === 'monthly' ? current.getUTCMonth() : original.getUTCMonth();
  let next = occurrence(year, month, firstDay);
  if (next < today) {
    if (event.repeat === 'monthly') {
      month++;
      if (month === 12) { month = 0; year++; }
    } else year++;
    next = occurrence(year, month, firstDay);
  }
  const previous = event.repeat === 'monthly'
    ? occurrence(month === 0 ? year - 1 : year, month === 0 ? 11 : month - 1, firstDay)
    : occurrence(year - 1, month, firstDay);
  const count = event.repeat === 'monthly'
    ? (year - original.getUTCFullYear()) * 12 + month - original.getUTCMonth()
    : year - original.getUTCFullYear();
  return {
    next, daysLeft: Math.round((next - today) / DAY), daysSince: null,
    count, progress: Math.max(0, Math.min(100, Math.round((today - previous) / (next - previous) * 100))),
  };
}

export function dateLabel(timestamp) {
  const d = new Date(timestamp);
  return `${d.getUTCFullYear()}年${d.getUTCMonth() + 1}月${d.getUTCDate()}日`;
}

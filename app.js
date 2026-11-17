import { localToday, parseDay, eventStatus, dateLabel } from './dates.js';

const KEY = 'anniversary-ring-v1';
const $ = selector => document.querySelector(selector);
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[char]));
const shortDate = timestamp => {
  const d = new Date(timestamp);
  return `${d.getUTCMonth() + 1}月${d.getUTCDate()}日`;
};
const newId = () => crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;

function validEvent(value) {
  return value && typeof value.id === 'string' && value.id.length <= 100
    && typeof value.name === 'string' && value.name.trim().length > 0 && value.name.length <= 40
    && typeof value.date === 'string' && parseDay(value.date) !== null
    && ['monthly', 'yearly', 'once'].includes(value.repeat)
    && typeof value.main === 'boolean';
}

function readEvents() {
  try {
    const data = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(data) ? data.filter(validEvent).slice(0, 100) : [];
  } catch { return []; }
}

let events = readEvents();
let editingId = null;
const repeatName = { monthly: '每月', yearly: '每年', once: '只一次' };

function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(events)); return true; }
  catch { return false; }
}

function sortedEvents() {
  const today = localToday();
  return [...events].map(event => ({ event, status: eventStatus(event, today) }))
    .sort((a, b) => (a.status.daysLeft ?? Infinity) - (b.status.daysLeft ?? Infinity) || a.event.name.localeCompare(b.event.name));
}

function renderFeature() {
  const selected = events.find(event => event.main) || sortedEvents()[0]?.event;
  if (!selected) {
    $('#feature').innerHTML = `<div class="feature-empty"><span>◌</span><div><small>THE FIRST DATE</small><h2>先记下一个重要的日子。</h2><p>让它从今天开始，慢慢靠近。</p></div><button type="button" data-add>写下第一个日子 ↗</button></div>`;
    return;
  }
  const status = eventStatus(selected);
  const number = status.daysLeft === null ? status.daysSince : status.daysLeft;
  const unit = status.daysLeft === null ? '天前' : status.daysLeft === 0 ? '就是今天' : '天后';
  const progress = status.progress ?? (status.daysLeft === null ? 100 : 0);
  const detail = status.daysLeft === null ? `${dateLabel(parseDay(selected.date))} · 那天已经过去`
    : `${dateLabel(status.next)} · ${repeatName[selected.repeat]}${status.count > 0 ? ` · 第 ${status.count} 次` : ''}`;
  $('#feature').innerHTML = `<div class="feature-copy"><small>THE ONE TO KEEP CLOSE</small><h2>${escapeHtml(selected.name)}</h2><p>${escapeHtml(detail)}</p><button type="button" data-edit="${escapeHtml(selected.id)}">编辑这个日子 ↗</button></div>
    <div class="ring-wrap"><div class="ring" style="--progress:${progress}"><div class="ring-inner"><span>${number}</span><small>${unit}</small></div></div><span class="ring-caption">${escapeHtml(repeatName[selected.repeat])} · ${shortDate(status.next ?? parseDay(selected.date))}</span></div>`;
}

function renderEvents() {
  const list = sortedEvents();
  $('#events').innerHTML = list.length ? list.map(({ event, status }, index) => {
    const count = status.daysLeft === null ? `${status.daysSince} 天前` : status.daysLeft === 0 ? '今天' : `${status.daysLeft} 天后`;
    return `<button type="button" class="event-row" data-edit="${escapeHtml(event.id)}"><span class="event-index">${String(index + 1).padStart(2, '0')}</span><span class="event-name"><b>${escapeHtml(event.name)}</b><small>${escapeHtml(event.date.replaceAll('-', '.'))} · ${repeatName[event.repeat]}${event.main ? ' · 首页' : ''}</small></span><span class="event-count">${count}</span><span class="event-arrow">↗</span></button>`;
  }).join('') : '<p class="empty-list">还没有纪念日。点右上角开始记。</p>';
}

function render() {
  $('#today').textContent = new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date());
  renderFeature();
  renderEvents();
}

function openEditor(id = null) {
  const event = events.find(item => item.id === id);
  editingId = event?.id ?? null;
  const form = $('#event-form');
  form.reset();
  form.elements.date.value = event?.date || localToday();
  form.elements.name.value = event?.name || '';
  form.elements.repeat.value = event?.repeat || 'yearly';
  form.elements.main.checked = event?.main || false;
  $('#dialog-title').textContent = event ? '编辑这个日子' : '记下一个日子';
  $('#delete-event').hidden = !event;
  $('#form-error').textContent = '';
  $('#editor').showModal();
  form.elements.name.focus();
}

$('#add-event').addEventListener('click', () => openEditor());
$('#close-editor').addEventListener('click', () => $('#editor').close());
$('#editor').addEventListener('click', event => { if (event.target === $('#editor')) $('#editor').close(); });
$('#feature').addEventListener('click', event => {
  if (event.target.closest('[data-add]')) openEditor();
  else if (event.target.closest('[data-edit]')) openEditor(event.target.closest('[data-edit]').dataset.edit);
});
$('#events').addEventListener('click', event => {
  const row = event.target.closest('[data-edit]');
  if (row) openEditor(row.dataset.edit);
});

$('#event-form').addEventListener('submit', event => {
  event.preventDefault();
  const form = event.currentTarget;
  const name = form.elements.name.value.trim();
  const date = form.elements.date.value;
  const repeat = form.elements.repeat.value;
  if (!name || name.length > 40 || parseDay(date) === null || !repeatName[repeat]) {
    $('#form-error').textContent = '请填好名字和有效日期。'; return;
  }
  const main = form.elements.main.checked || !events.length;
  const next = { id: editingId || newId(), name, date, repeat, main };
  const before = events;
  events = editingId ? events.map(item => item.id === editingId ? next : item) : [...events, next];
  if (main) events = events.map(item => ({ ...item, main: item.id === next.id }));
  if (!persist()) { events = before; $('#form-error').textContent = '浏览器没有保存成功，请检查站点存储权限。'; return; }
  $('#editor').close();
  render();
});

$('#delete-event').addEventListener('click', () => {
  const event = events.find(item => item.id === editingId);
  if (!event || !confirm(`删除「${event.name}」？`)) return;
  const before = events;
  events = events.filter(item => item.id !== editingId);
  if (!persist()) { events = before; $('#form-error').textContent = '删除没有保存成功。'; return; }
  $('#editor').close();
  render();
});

$('#export-data').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify({ format: 'anniversary-ring-v1', events }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = Object.assign(document.createElement('a'), { href: url, download: `anniversary-ring-${localToday()}.json` });
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});

$('#import-data').addEventListener('change', async event => {
  const file = event.target.files?.[0];
  event.target.value = '';
  if (!file) return;
  try {
    if (file.size > 128 * 1024) throw new Error('备份文件太大了。');
    const data = JSON.parse(await file.text());
    if (data?.format !== 'anniversary-ring-v1' || !Array.isArray(data.events) || data.events.length > 100 || !data.events.every(validEvent)) throw new Error('这不是有效的纪念日备份。');
    const ids = new Set(data.events.map(item => item.id));
    if (ids.size !== data.events.length) throw new Error('备份里有重复记录。');
    if (!confirm(`导入 ${data.events.length} 个纪念日？当前记录会被替换。`)) return;
    const before = events;
    events = data.events.map(item => ({ id: item.id, name: item.name.trim(), date: item.date, repeat: item.repeat, main: item.main }));
    const main = events.find(item => item.main)?.id;
    events = events.map(item => ({ ...item, main: item.id === main }));
    if (!persist()) { events = before; throw new Error('浏览器没有保存成功。'); }
    render();
  } catch (error) { alert(error.message); }
});

render();

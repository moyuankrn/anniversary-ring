import assert from 'node:assert/strict';
import { eventStatus, parseDay } from '../dates.js';

assert.equal(parseDay('2025-02-29'), null);
assert.equal(parseDay('2024-02-29'), Date.UTC(2024, 1, 29));
assert.deepEqual(eventStatus({ date: '2024-01-31', repeat: 'monthly' }, '2024-02-01').daysLeft, 28);
assert.deepEqual(eventStatus({ date: '2024-01-31', repeat: 'monthly' }, '2024-02-29').daysLeft, 0);
assert.deepEqual(eventStatus({ date: '2024-01-31', repeat: 'monthly' }, '2024-03-01').daysLeft, 30);
assert.deepEqual(eventStatus({ date: '2024-02-29', repeat: 'yearly' }, '2025-02-28').daysLeft, 0);
assert.deepEqual(eventStatus({ date: '2024-02-29', repeat: 'yearly' }, '2025-03-01').daysLeft, 364);
assert.deepEqual(eventStatus({ date: '2026-12-05', repeat: 'once' }, '2026-11-17').daysLeft, 18);
assert.deepEqual(eventStatus({ date: '2026-11-01', repeat: 'once' }, '2026-11-17').daysSince, 16);
console.log('Date calculations passed');

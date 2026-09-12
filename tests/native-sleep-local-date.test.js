const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(process.env.NATIVE_SLEEP_SOURCE || path.join(__dirname, '../lib/native-health.js'), 'utf8');

async function run(timezone, sample, expectedDate, options = {}) {
  process.env.TZ = timezone;
  const writes = [], queries = [], warnings = [];
  const context = {
    Date,
    console: { warn: (...args) => warnings.push(args), log() {}, error() {} },
    window: {
      _nativeHealthReady: true,
      _CapacitorHealth: { readSamples: async () => ({ samples: [sample] }) }
    }
  };
  vm.createContext(context);
  vm.runInContext(source, context);
  const client = {
    from(table) {
      return {
        select() { return this; },
        eq() { return this; },
        async gte(_, date) {
          queries.push(date);
          return { data: options.covered ? [{ date: expectedDate }] : [], error: options.readError || null };
        },
        async insert(row) { writes.push({ table, ...row }); return { error: options.writeError || null }; }
      };
    }
  };
  await context.window.NativeHealth.syncSleepForChallenge(client, 'test-member');
  if (options.covered || options.readError || options.invalid) {
    assert.equal(writes.length, 0);
  } else {
    assert.equal(writes.length, 1);
    assert.equal(writes[0].date, expectedDate);
    assert.equal(writes[0].total_sleep_minutes, 518);
  }
  if (queries.length) {
    const start = new Date();
    start.setDate(start.getDate() - 7);
    const local = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`;
    assert.ok(queries.every(date => date === local));
  }
  if (options.readError || options.writeError) assert.ok(warnings.length > 0);
}

(async () => {
  const originalTimezone = process.env.TZ;
  try {
    const mondayMorning = { startDate: '2026-09-06T20:00:00+10:00', endDate: '2026-09-07T04:38:00+10:00' };
    await run('Australia/Brisbane', mondayMorning, '2026-09-07');
    await run('Australia/Sydney', { startDate: '2026-10-04T20:00:00+11:00', endDate: '2026-10-05T04:38:00+11:00' }, '2026-10-05');
    await run('America/Los_Angeles', { startDate: '2026-09-07T15:00:00-07:00', endDate: '2026-09-07T23:38:00-07:00' }, '2026-09-07');
    await run('UTC', mondayMorning, '2026-09-06');
    await run('Australia/Brisbane', mondayMorning, '2026-09-07', { covered: true });
    await run('Australia/Brisbane', mondayMorning, '2026-09-07', { readError: { message: 'permission denied' } });
    await run('Australia/Brisbane', mondayMorning, '2026-09-07', { writeError: { message: 'connection failed' } });
    await run('Australia/Brisbane', { startDate: 'invalid', endDate: 'invalid' }, null, { invalid: true });
    console.log('Native sleep: local dates, DST, week boundary, existing data and failure handling passed.');
  } finally {
    if (originalTimezone === undefined) delete process.env.TZ;
    else process.env.TZ = originalTimezone;
  }
})().catch(error => { console.error(error); process.exitCode = 1; });

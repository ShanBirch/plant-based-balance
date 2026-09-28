// Run-level local lease. Separate from paid-worker and per-message DB claims.
// SQLite serializes short-lived callers and rolls back interrupted writes.
const { DatabaseSync } = require('node:sqlite');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');

const LEASE_MS = 15 * 60 * 1000;
function lease(command, { file, token, now = Date.now() } = {}) {
    file ||= path.join(process.env.CODEX_HOME || path.join(os.homedir(), '.codex'),
        'automations', 'balance-lead-client-dm-manager', 'manager-lease.sqlite');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const db = new DatabaseSync(file);
    try {
        db.exec('PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS lease (id INTEGER PRIMARY KEY CHECK(id=1), token TEXT NOT NULL, started_at INTEGER NOT NULL, expires_at INTEGER NOT NULL); BEGIN IMMEDIATE;');
        const current = db.prepare('SELECT * FROM lease WHERE id=1').get();
        let result;
        if (command === 'acquire') {
            if (current && current.expires_at > now) {
                result = { outcome: 'manager_already_running', expires_at: new Date(current.expires_at).toISOString() };
            } else {
                const next = crypto.randomUUID();
                db.prepare('INSERT OR REPLACE INTO lease VALUES (1,?,?,?)').run(next, now, now + LEASE_MS);
                result = { outcome: 'acquired', token: next, started_at: new Date(now).toISOString(),
                    stop_claiming_at: new Date(now + 7 * 60000).toISOString(),
                    release_by: new Date(now + 9 * 60000).toISOString(),
                    expires_at: new Date(now + LEASE_MS).toISOString() };
            }
        } else if (command === 'check' || command === 'release') {
            if (!token) throw new Error('Exact acquired token is required');
            const owned = current?.token === token && current.expires_at > now;
            if (command === 'release' && current?.token === token) {
                db.prepare('DELETE FROM lease WHERE id=1 AND token=?').run(token);
                result = { outcome: 'released' };
            } else {
                result = { outcome: owned ? 'owned' : 'lease_not_owned',
                    can_claim: owned && now < current.started_at + 7 * 60000,
                    can_send: owned && now < current.started_at + 9 * 60000 };
            }
        } else if (command === 'status') {
            result = { outcome: current && current.expires_at > now ? 'busy' : 'available',
                expires_at: current ? new Date(current.expires_at).toISOString() : null };
        } else throw new Error('Use acquire, check TOKEN, release TOKEN, or status');
        db.exec('COMMIT');
        return result;
    } finally { db.close(); }
}
module.exports = { lease, LEASE_MS };
if (require.main === module) {
    try { console.log(JSON.stringify(lease(process.argv[2], { token: process.argv[3], file: process.env.BALANCE_DM_LEASE_FILE }))); }
    catch (error) { console.error(JSON.stringify({ outcome: 'manager_lease_failed', error: error.message })); process.exitCode = 1; }
}

const { isDeepStrictEqual: equal } = require('node:util');
const object = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};

// Apply only the writer's changes to the current JSON, never its old snapshot.
// An independently changed value wins a same-key conflict.
function mergeChanges(base, intended, current) {
    base = object(base); intended = object(intended); current = object(current);
    const merged = { ...current };
    for (const key of new Set([...Object.keys(base), ...Object.keys(intended)])) {
        if (['__proto__', 'constructor', 'prototype'].includes(key) || equal(base[key], intended[key])) continue;
        if (intended[key] && typeof intended[key] === 'object' && !Array.isArray(intended[key])
            && (!base[key] || typeof base[key] === 'object' && !Array.isArray(base[key]))
            && (!current[key] || typeof current[key] === 'object' && !Array.isArray(current[key]))) {
            merged[key] = mergeChanges(base[key], intended[key], current[key]);
        } else if (equal(current[key], base[key])) {
            if (Object.hasOwn(intended, key)) merged[key] = intended[key];
            else delete merged[key];
        }
    }
    return merged;
}

async function patchIgThread(query, base, patch) {
    if (!base?.id) throw new Error('Thread identity missing for guarded update');
    const path = 'ig_threads?id=eq.' + encodeURIComponent(base.id);
    for (let attempt = 0; attempt < 4; attempt++) {
        const [current] = await query(path + '&select=*&limit=1');
        if (!current) throw new Error('Thread disappeared during guarded update');
        const body = {};
        for (const [key, value] of Object.entries(patch)) {
            if (key === 'id' || key === 'updated_at') continue;
            if (key === 'custom_data') body[key] = mergeChanges(base.custom_data, value, current.custom_data);
            else if (['last_inbound_at', 'last_outbound_at', 'last_memory_extracted_at'].includes(key)) {
                if (!current[key] || Date.parse(value) > Date.parse(current[key])) body[key] = value;
            } else if (!equal(value, base[key]) && equal(current[key], base[key])) body[key] = value;
        }
        if (!Object.keys(body).length) return current;
        const version = current.updated_at ? '&updated_at=eq.' + encodeURIComponent(current.updated_at) : '&updated_at=is.null';
        const rows = await query(path + version, { method: 'PATCH', body, prefer: 'return=representation' });
        if (rows?.[0]) return rows[0];
    }
    throw new Error('Thread changed repeatedly during guarded update; retry required');
}
module.exports = { mergeChanges, patchIgThread };

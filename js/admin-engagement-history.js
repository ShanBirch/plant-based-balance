(function (root) {
    'use strict';
    const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const stamp = value => Date.parse(value);
    function build(thread, messages, options = {}) {
        const timeZone = options.timeZone || 'Australia/Brisbane';
        const day = value => new Intl.DateTimeFormat('en-CA', {timeZone, year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));
        const seen = new Set();
        const rows = messages.filter(m => m.thread_id === thread.id && m.id && ['in','out'].includes(m.direction) && Number.isFinite(stamp(m.created_at))).filter(m => !seen.has(m.id) && seen.add(m.id)).sort((a,b) => stamp(a.created_at)-stamp(b.created_at) || String(a.id).localeCompare(String(b.id)));
        const sessions = [];
        for (const row of rows) {
            let session = sessions.at(-1);
            if (!session || stamp(row.created_at)-stamp(session.messages.at(-1).created_at) >= 24*3600000) sessions.push(session = {messages:[]});
            session.messages.push(row);
        }
        const substantive = m => m.direction === 'in' && /\p{L}/u.test(m.text || '') && !/^(thanks?( you)?|thank you|ok(ay)?|yes|no|cool|great|cheers|hi|hello|hey)[!.\s]*$/i.test((m.text || '').trim()) && (m.text || '').trim().split(/\s+/).length >= 5;
        sessions.forEach(s => { s.substantive = s.messages.some(substantive) && s.messages.some(m => m.direction === 'out' && /\p{L}/u.test(m.text || '')); });
        const last = rows.at(-1);
        const suggestion = !options.complete ? {action:'Review history coverage',reason:'Only part of the captured history is loaded. No follow-up recommendation is supported yet.',timing:'After loading the complete captured history'} : !last ? {action:'Wait / no follow-up',reason:'No captured messages support an outreach suggestion.',timing:'Until new evidence arrives'} : last.direction === 'in' ? {action:'Review and draft a reply',reason:'The last captured message is inbound. Review its meaning before replying.',timing:'During the next inbox review'} : {action:'Wait / no follow-up',reason:'The last captured message is outbound; another message could repeat unanswered outreach.',timing:'Until they reply or Shannon reviews an explicitly agreed follow-up'};
        if (options.complete && last?.direction === 'in') {
            suggestion.reason = `Start from their latest words: “${last.text || '[Media or empty text]'}”. Answer what they actually asked or acknowledge the detail they shared. A reply is optional if none is needed; do not infer interest from message volume.`;
        }
        return {rows,sessions,timeZone,complete:options.complete === true,inboundDays:new Set(rows.filter(m => m.direction==='in').map(m => day(m.created_at))).size,returning:Math.max(0,sessions.filter(s => s.substantive).length-1),suggestion,last,topics:rows.filter(substantive).slice(-3),goals:rows.filter(m => m.direction === 'in' && /\b(i want|my goal|i aim|i would like|i'd like)\b/i.test(m.text || '')).slice(-3)};
    }
    function render(model, thread) {
        const evidence = m => `<li><a href="#engagement-message-${esc(m.id)}">${esc(m.id)}</a> · ${esc(m.created_at)} · ${esc(m.text || '[Media or empty text]')}</li>`;
        return `<details class="engagement-history" style="color:#0f172a;background:#f8fafc;padding:12px;border:1px solid #cbd5e1;border-radius:10px;overflow-wrap:anywhere"><summary>Engagement history · ${model.inboundDays} inbound days${model.complete?'':' in loaded sample'}</summary><p>Identity scope: this ${esc(thread.channel || 'channel')} thread only. ${thread.linked_user_id?'A recorded app-account link exists; its verification has not been checked.':'No verified app-account association is available.'} Public comments and matching display names are excluded.</p><p>${model.rows.length} raw messages · ${model.sessions.filter(s=>s.substantive).length} candidate substantive exchanges · ${model.returning} candidate returning exchanges. Days use ${esc(model.timeZone)}. An exchange starts after a 24-hour gap; substantive candidates require a detailed inbound and a textual outbound. These are transparent heuristics, not verified interest.</p><p>${model.complete?'Complete captured history loaded; uncaptured native exchanges may exist.':'Partial captured history; counts are lower bounds.'}</p><h4>Recent topics: source excerpts</h4><ul>${model.topics.map(evidence).join('') || '<li>No detailed inbound text available.</li>'}</ul><h4>Explicit goal language: source excerpts</h4><ul>${model.goals.map(evidence).join('') || '<li>No explicit goal language found. Stored memory is not treated as a verified stated goal.</li>'}</ul><p>Where it stopped: ${model.last?`${esc(model.last.direction==='in'?'Inbound awaiting review':'Outbound awaiting response')} · ${esc(model.last.created_at)} · ${esc(model.last.id)}`:'No captured exchange.'}</p><p><strong>Draft suggestion: ${esc(model.suggestion.action)}</strong><br>${esc(model.suggestion.reason)}<br>Timing: ${esc(model.suggestion.timing)}</p><p>No send, scheduling, queue or approval action is performed.</p><ol>${model.rows.map(m=>`<li id="engagement-message-${esc(m.id)}"><strong>${esc(m.direction==='in'?'Contact':'Shannon')}</strong> · ${esc(m.created_at)} · ${esc(m.source || 'Source not recorded')} · ${esc(m.id)}<p>${esc(m.text || '[Media or empty text]')}</p></li>`).join('')}</ol></details>`;
    }
    async function load(client, thread) {
        if (!thread?.id || !client?.from) throw new Error('Signed-in history client and contact are required');
        const rows = [];
        // Existing signed-in client and RLS permissions only. No service key or mutation.
        for (let offset=0; offset<10000; offset+=500) {
            const {data,error} = await client.from('ig_messages').select('id,thread_id,direction,text,source,created_at').eq('thread_id',thread.id).order('created_at',{ascending:true}).order('id',{ascending:true}).range(offset,offset+499);
            if (error) throw error;
            rows.push(...(data || []));
            if ((data || []).length<500) return build(thread,rows,{complete:true});
        }
        return build(thread,rows,{complete:false});
    }
    const api = {build,render,load};
    if (typeof module !== 'undefined') module.exports = api;
    else root.BalanceEngagementHistory = api;
})(typeof window !== 'undefined' ? window : globalThis);

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// This utility has no credentials, network requests, database writes or send path.
// Execute its SELECT with the authenticated database connector, then render the result.
export function buildQuery(start, end) {
    const from = new Date(start), until = new Date(end);
    if (!Number.isFinite(+from) || !Number.isFinite(+until) || +until <= +from) {
        throw new Error('Supply valid --start and --end timestamps, with end after start.');
    }
    if (!/(Z|[+-]\d\d:\d\d)$/i.test(start) || !/(Z|[+-]\d\d:\d\d)$/i.test(end)) {
        throw new Error('Timestamps must include a timezone offset.');
    }
    return `with bounds as (
  select '${from.toISOString()}'::timestamptz as start_at, '${until.toISOString()}'::timestamptz as end_at
), periods as (
  select 'current'::text as period, start_at, end_at from bounds
  union all select 'previous', start_at-(end_at-start_at), start_at from bounds
), scoped_threads as (
  select t.*, coalesce(nullif(t.custom_data->>'acquisition_mode',''),'unknown') as lane,
    coalesce(nullif(t.custom_data->>'bot_account',''),'unknown') as account
  from public.ig_threads t
  where t.linked_user_id is null
    and coalesce(t.custom_data->>'acquisition_mode','') <> 'existing_client'
    and coalesce(t.custom_data->>'merged_into_ig_thread_id','') = ''
    and coalesce(t.custom_data->>'merged_into_thread_id','') = ''
    and t.id not in ('4baea56e-eab4-4887-a732-39b14e983d44','ae26f9ef-b7aa-41ac-b9cd-8ecb616ab6fc')
), activity as (
  select p.period,t.channel,t.account,t.lane,count(distinct t.id) as active_threads,
    count(distinct t.id) filter(where m.direction='in') as inbound_threads,
    count(distinct t.id) filter(where m.direction='out') as outbound_threads,
    count(*) filter(where m.direction='in') as inbound_messages,
    count(*) filter(where m.direction='out') as outbound_messages,
    count(distinct t.id) filter(where t.qualifier is null) as missing_qualifier_threads,
    count(distinct t.id) filter(where t.qualifier is not null
      and coalesce(t.qualifier->>'evaluated_at','') < to_char(p.start_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS')) as stale_qualifier_threads
  from periods p join public.ig_messages m on m.created_at >= p.start_at and m.created_at < p.end_at
  join scoped_threads t on t.id=m.thread_id
  where m.direction in ('in','out') group by p.period,t.channel,t.account,t.lane
), transport as (
  select p.period,m.source,m.author_type,count(*) as messages
  from periods p join public.ig_messages m on m.created_at>=p.start_at and m.created_at<p.end_at
  join scoped_threads t on t.id=m.thread_id where m.direction='out'
  group by p.period,m.source,m.author_type
), events as (
  select p.period,t.channel,t.account,t.lane,e.event_type,e.source_system,
    count(*) as recorded_events,count(distinct e.ig_thread_id) as recorded_threads,
    count(*) filter(where e.ig_message_id is not null) as message_linked_events
  from periods p join public.growth_outcome_events e on e.occurred_at>=p.start_at and e.occurred_at<p.end_at
  join scoped_threads t on t.id=e.ig_thread_id
  group by p.period,t.channel,t.account,t.lane,e.event_type,e.source_system
), bookings as (
  select p.period,
    (select count(*) from public.balance_bookings b where b.created_at>=p.start_at and b.created_at<p.end_at) as created,
    (select count(*) from public.balance_bookings b where b.created_at>=p.start_at and b.created_at<p.end_at
      and b.status='confirmed') as created_currently_confirmed,
    (select count(*) from public.balance_bookings b join scoped_threads t on t.id::text=b.metadata->>'ig_thread_id'
      where b.created_at>=p.start_at and b.created_at<p.end_at and b.status='confirmed') as created_linked_to_scoped_thread,
    (select count(*) from public.balance_bookings b where b.starts_at>=p.start_at and b.starts_at<p.end_at
      and b.status='confirmed') as scheduled_currently_confirmed,
    (select count(*) from public.balance_bookings b where b.starts_at>=p.start_at and b.starts_at<p.end_at
      and b.status='confirmed' and coalesce(b.metadata->>'ig_thread_id','')='') as scheduled_without_thread_link
  from periods p
)
select jsonb_build_object(
  'version','lead_call_funnel_v1','generated_at',now(),'timezone','Australia/Brisbane',
  'periods',(select jsonb_agg(to_jsonb(p) order by period) from periods p),
  'activity',coalesce((select jsonb_agg(to_jsonb(a) order by period,channel,account,lane) from activity a),'[]'::jsonb),
  'transport',coalesce((select jsonb_agg(to_jsonb(t) order by period,source,author_type) from transport t),'[]'::jsonb),
  'events',coalesce((select jsonb_agg(to_jsonb(e) order by period,channel,lane,event_type) from events e),'[]'::jsonb),
  'bookings',(select jsonb_agg(to_jsonb(b) order by period) from bookings b)
) as report`;
}

const clean = value => String(value ?? 'unknown').replace(/[|\r\n]/g, ' ');
const local = value => new Intl.DateTimeFormat('en-AU', {
    timeZone: 'Australia/Brisbane', dateStyle: 'medium', timeStyle: 'short',
}).format(new Date(value));

export function renderReport(report) {
    if (report?.version !== 'lead_call_funnel_v1' || !Array.isArray(report.periods)) throw new Error('Unsupported snapshot.');
    const current = report.periods.find(p => p.period === 'current');
    const previous = report.periods.find(p => p.period === 'previous');
    const currentActivity = report.activity.filter(r => r.period === 'current');
    const total = key => currentActivity.reduce((sum, r) => sum + Number(r[key] || 0), 0);
    const currentBooking = report.bookings.find(r => r.period === 'current');
    const progressionTracked = report.events.some(r => r.period === 'current' && /goal|blocker|call|book/.test(r.event_type));
    const lines = [
        '# Balance lead-to-call report', '',
        `Current: ${local(current.start_at)} to ${local(current.end_at)} (end exclusive).`,
        `Comparison: ${local(previous.start_at)} to ${local(previous.end_at)}. All times Brisbane.`,
        `Database snapshot: ${local(report.generated_at)}.`, '',
        'Objective: consented coaching calls. Goals and blockers are useful evidence, not mandatory booking gates.', '',
        '## Readout', '',
        `Captured scope: ${total('active_threads')} active threads, ${total('inbound_messages')} incoming messages and ${total('outbound_messages')} outgoing messages. These are activity counts, not qualified prospects.`, '',
        `Qualification freshness: ${total('missing_qualifier_threads')} threads have no qualifier; ${total('stale_qualifier_threads')} have a pre-period or undated evaluation.`, '',
        progressionTracked ? 'Some progression events were captured; verify their source evidence before counting actual outcomes.' : 'Goal, blocker and call progression is unmeasured in this period: no corresponding event rows were captured. Read the actual conversations before judging progress.', '',
        currentBooking ? `Booking records: ${currentBooking.created} created during the period; ${currentBooking.scheduled_currently_confirmed} confirmed appointments have database starts in the period. Check the calendar for reschedules and record attendance separately.` : 'Booking coverage is unavailable.', '',
        '## Captured activity', '',
        '| Period | Channel | Account | Saved acquisition lane | Active threads | Inbound threads | Outbound threads | Inbound messages | Outbound messages | Missing qualifier | Stale qualifier |',
        '|---|---|---|---|---:|---:|---:|---:|---:|---:|---:|',
        ...report.activity.map(r => `| ${[r.period,r.channel,r.account,r.lane,r.active_threads,r.inbound_threads,r.outbound_threads,r.inbound_messages,r.outbound_messages,r.missing_qualifier_threads,r.stale_qualifier_threads].map(clean).join(' | ')} |`), '',
        'These are captured thread counts, not unique people or outreach conversion rates. Linked clients, saved existing-client lanes, explicit merged mirrors and two known test threads are excluded using current metadata for both periods. Converted prospects linked since acquisition are therefore absent: use a frozen acquisition cohort for eventual conversion rates. Unlinked clients, personal contacts, unidentified mirrors and uncaptured native messages still require review. Saved acquisition lanes describe current stored metadata; an outreach reply can be labelled organic inbound.', '',
        '## Outcome trail', '',
        '| Period | Channel | Account | Lane | Recorded event | Source | Event rows | Distinct threads | Rows linked to a message |',
        '|---|---|---|---|---|---|---:|---:|---:|',
        ...report.events.map(r => `| ${[r.period,r.channel,r.account,r.lane,r.event_type,r.source_system,r.recorded_events,r.recorded_threads,r.message_linked_events].map(clean).join(' | ')} |`), '',
        'Missing goal/blocker/call events mean unmeasured progression, not zero actual progression. Stored stage labels and memory summaries are not counted as verified outcomes. Source-linked rows still need the complete episode checked before using them to learn wording.', '',
        '## Booking records', '',
        '| Period | Created | Created, currently confirmed | Created confirmed, linked to scoped thread | Scheduled, currently confirmed | Scheduled without thread link |',
        '|---|---:|---:|---:|---:|---:|',
        ...report.bookings.map(r => `| ${[r.period,r.created,r.created_currently_confirmed,r.created_linked_to_scoped_thread,r.scheduled_currently_confirmed,r.scheduled_without_thread_link].map(clean).join(' | ')} |`), '',
        'Booking totals cover all Balance booking sources; only the explicit linked column is attributed to this captured DM scope. Status is the current snapshot, not historic status at period end. Check the calendar for cancellations/reschedules. A scheduled or confirmed record does not establish attendance. Attendance, no-show and paid-after-call outcomes remain unknown until separately evidenced.', '',
        '## Delivery provenance', '',
        '| Period | Source | Recorded author | Outbound messages |',
        '|---|---|---|---:|',
        ...report.transport.map(r => `| ${[r.period,r.source,r.author_type,r.messages].map(clean).join(' | ')} |`), '',
        'Native inbox echoes can label Codex-written text as Shannon. Do not use these labels to rank automations or compare human versus AI performance. Require an exact operator run/send receipt before assigning ownership.', '',
        '## Weekly review', '',
        'Review complete episodes, including silence, declines and price questions. Save private message IDs for verified goal, blocker, call invitation, acceptance and handoff evidence. Reconcile each actual booking and attendance record. Report counts and unknowns before rates. No experiment winner can be selected without prospective assignment and a common observation window.', '',
    ];
    return lines.join('\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
    try {
        const args = {};
        for (let i = 2; i < process.argv.length; i += 2) {
            const flag = process.argv[i], value = process.argv[i + 1];
            if (!['--start','--end','--snapshot','--output'].includes(flag) || !value) throw new Error('Use --start/--end to emit SELECT, or --snapshot <JSON> to render; optional --output <path>.');
            args[flag.slice(2)] = value;
        }
        const output = args.snapshot
            ? renderReport(JSON.parse(fs.readFileSync(args.snapshot, 'utf8')))
            : buildQuery(args.start || '', args.end || '');
        if (args.output) {
            fs.mkdirSync(path.dirname(path.resolve(args.output)), { recursive: true });
            fs.writeFileSync(args.output, output + '\n', { mode: 0o600 });
        } else process.stdout.write(output + '\n');
    } catch (error) { console.error(error.message); process.exitCode = 1; }
}

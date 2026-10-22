"""Pure Story ownership request construction; no RPC, browser or sending.

The existing owner supplies reconciled counts/cursor and fresh permitted evidence.
Output does not authorize actions or replace atomic ownership/send-time checks.
"""
import copy
import json
import re
import sys
from datetime import datetime, timedelta, timezone

BRISBANE = timezone(timedelta(hours=10))

def instant(value):
    result = datetime.fromisoformat(value.replace('Z', '+00:00'))
    if result.tzinfo is None:
        raise ValueError('timezone required')
    return result

def build(data):
    now = instant(data['now'])
    observed = instant(data['observed_at'])
    if data.get('complete') is not True or not 0 <= (now-observed).total_seconds() <= 60:
        raise ValueError('fresh complete permitted snapshot required')
    if any(data.get(k) for k in ('access_denied', 'account_restriction', 'unknown_outcome')):
        raise ValueError('unresolved hard stop')
    if data.get('project_id') != 'hzapaorxqboevxnumxkv':
        raise ValueError('project mismatch')
    parallel_runs = set()
    for lease in data['leases']:
        if lease['status'] == 'running' and instant(lease['expires_at']) > now:
            binding = lease.get('browser_surface', {})
            own = data['browser_surface']
            if (binding.get('browser_id') == own.get('browser_id')
                and binding.get('tab_id') == own.get('tab_id')):
                raise ValueError('same tab already owned')
            if (binding.get('kind') == 'instagram'
                and lease.get('lane') == 'plant_based_discovery_follows'
                and binding.get('account') == 'shan_n_sunny'
                and binding.get('browser_id') and binding.get('tab_id')
                and lease.get('run_id')):
                parallel_runs.add(lease['run_id'])
            elif binding.get('kind') != 'meta_business_suite':
                raise ValueError('unexpired owner; defer')
    excluded_claims = []
    if 'active_claims' in data:
        if data.get('active_claims_complete') is not True or type(data['active_claims']) is not list:
            raise ValueError('claims indeterminate')
        for claim in data['active_claims']:
            if instant(claim['claim_expires_at']) <= now:
                continue
            reactive = (claim.get('owner') == 'dm_manager'
                        and claim.get('action_type') == 'reply_inbound' and claim.get('thread_id'))
            outreach = (claim.get('owner') == 'discovery_operator'
                        and claim.get('action_type') in ('discovery_follow', 'welcome_follower')
                        and claim.get('claim_run_id') in parallel_runs)
            if (not (reactive or outreach) or not claim.get('id')
                or not claim.get('ig_username') or not claim.get('claim_run_id')):
                raise ValueError('unclassified or proactive active claim; defer')
            excluded_claims.append(copy.deepcopy(claim))
    elif data.get('active_claims_clear') is not True:
        raise ValueError('claims indeterminate')
    budget = data['budget']
    if budget['day'] != now.astimezone(BRISBANE).date().isoformat():
        raise ValueError('Brisbane day mismatch')
    if budget.get('cap') != 60:
        raise ValueError('daily cap mismatch')
    numbers = [budget['confirmed'], budget['reserved'], data['confirmed']]
    if any(type(x) is not int or x < 0 for x in numbers):
        raise ValueError('invalid counts')
    confirmed = data['confirmed']
    target = data.get('target', 20)
    if type(target) is not int or target not in (20, 60):
        raise ValueError('unsupported logical target')
    if target == 60 and data.get('goal_contract') != 'daily-sixty-contract-20261014':
        raise ValueError('explicit daily goal contract required')
    if confirmed > budget['confirmed']:
        raise ValueError('logical count exceeds current-day shared confirmed')
    capacity = 60-budget['confirmed']-budget['reserved']
    if confirmed >= target or capacity <= 0:
        raise ValueError('no remaining allowance')
    base, run = data['logical_base_id'], data['run_id']
    if not base or not re.fullmatch(re.escape(base)+r'-seg[1-9][0-9]*', run):
        raise ValueError('fresh segment must preserve logical base')
    ids = data['canonical_ids']
    if len(ids) != confirmed or len(set(ids)) != len(ids):
        raise ValueError('exact confirmed canonical IDs required')
    surface = copy.deepcopy(data['browser_surface'])
    if (surface.get('kind') != 'instagram' or surface.get('account') != 'shan_n_sunny'
        or not surface.get('browser_id') or not surface.get('tab_id')
        or not re.match(r'^https://(www\.)?instagram\.com(/|$)', surface.get('url', ''))):
        raise ValueError('verified Instagram binding required')
    age = (now-instant(surface['verified_at'])).total_seconds()
    if not -30 <= age <= 300:
        raise ValueError('browser verification stale')
    cursor = copy.deepcopy(data['cursor'])
    if cursor.get('logical_base_id') != base:
        raise ValueError('cursor logical base mismatch')
    schedule = data.get('scheduled_slot')
    if schedule is not None and schedule not in ('06:30', '10:00', '19:00'):
        raise ValueError('invalid scheduled slot label')
    if schedule is None and cursor.get('scheduled_slot') is not None:
        raise ValueError('manual run cannot inherit scheduled credit')
    if 'active_claims' in data:
        cursor['recipient_claim_exclusions'] = excluded_claims
    cursor.update(logical_base_id=base, confirmed=confirmed, target=target,
                  remaining=target-confirmed, browser_surface=surface,
                  canonical_ids=copy.deepcopy(ids))
    if target == 60:
        cursor.update(goal_contract=data['goal_contract'], daily_day=budget['day'])
    if schedule is not None:
        if cursor.get('scheduled_slot', schedule) != schedule:
            raise ValueError('schedule attribution mismatch')
        cursor['scheduled_slot'] = schedule
    return {'rpc': 'start_ig_browser_shift', 'arguments': {
        'p_run_id': run, 'p_lane': 'active_client_instagram_community',
        'p_slot': 0, 'p_cursor_start': cursor, 'p_lease_seconds': 300},
        'logical_base_id': base, 'remaining': target-confirmed,
        'max_new_attempts': min(target-confirmed, capacity),
        'daily_confirmed': budget['confirmed'], 'daily_reserved': budget['reserved'],
        'canonical_ids': copy.deepcopy(ids),
        'reserved_actions': copy.deepcopy(data['reserved_actions'])}

def build_checkpoint(data):
    now, observed = instant(data['now']), instant(data['observed_at'])
    if data.get('complete') is not True or not 0 <= (now-observed).total_seconds() <= 60:
        raise ValueError('fresh complete permitted snapshot required')
    if data.get('project_id') != 'hzapaorxqboevxnumxkv' or data.get('access_denied'):
        raise ValueError('project or permission hard stop')
    lease = data['lease']
    if data.get('owned_run_verified') is not True or lease['run_id'] != data['run_id'] or lease['status'] != 'running' or instant(lease['expires_at']) <= now:
        raise ValueError('current owned unexpired lease required')
    for key in ('cursor_current','counts','last_surface','next_resume'):
        if type(data.get(key)) is not dict:
            raise ValueError(key + ' must be object')
    for key in ('canonical_ids','uncertain_actions','block_evidence'):
        if type(data.get(key)) is not list:
            raise ValueError(key + ' must be array')
    surface = data['last_surface']
    if surface.get('kind') != 'instagram' or surface.get('account') != 'shan_n_sunny' or surface.get('tab_id') != lease['tab_id']:
        raise ValueError('owned surface mismatch')
    confirmed = data['cursor_current'].get('confirmed')
    ids = data['canonical_ids']
    counts_confirmed = data['counts'].get('confirmed',data['counts'].get('verified_native_actions'))
    if type(confirmed) is not int or confirmed < 0 or counts_confirmed != confirmed or len(ids) != confirmed or len(set(ids)) != len(ids):
        raise ValueError('exact count and canonical IDs required')
    return {'rpc':'heartbeat_ig_browser_shift','arguments':{
        'p_run_id':data['run_id'],
        **{'p_'+key:copy.deepcopy(data[key]) for key in ('cursor_current','counts','last_surface','canonical_ids','uncertain_actions','block_evidence','next_resume')},
        'p_lease_seconds':300}}

if __name__ == '__main__':
    print(json.dumps(build(json.load(sys.stdin)), indent=2))

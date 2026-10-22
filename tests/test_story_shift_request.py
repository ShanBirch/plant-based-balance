import copy
import unittest
from story_shift_request import build

def snapshot():
    return dict(now='2026-10-11T07:40:00Z', observed_at='2026-10-11T07:39:50Z',
        complete=True, project_id='hzapaorxqboevxnumxkv', leases=[], active_claims_clear=True,
        budget=dict(day='2026-10-11', cap=60, confirmed=29, reserved=2),
        confirmed=9, logical_base_id='manual-base', run_id='manual-base-seg5',
        canonical_ids=[str(i) for i in range(9)], reserved_actions=['failed-one','failed-two'],
        cursor=dict(logical_base_id='manual-base', owners=['already-reviewed'], skips={'held':'hold'}),
        browser_surface=dict(kind='instagram', account='shan_n_sunny', browser_id='3',
            tab_id='fresh', url='https://www.instagram.com/', verified_at='2026-10-11T07:39:30Z'))

class RequestTests(unittest.TestCase):
    def test_supported_slot_and_nested_binding(self):
        d=snapshot(); r=build(d); a=r['arguments']
        self.assertEqual(a['p_slot'],0); self.assertEqual(a['p_lease_seconds'],300)
        self.assertEqual(a['p_cursor_start']['browser_surface'],d['browser_surface'])
        self.assertNotIn('browser_id',a['p_cursor_start'])
    def test_preserves_manual_count_cursor_reservations_without_mutation(self):
        d=snapshot(); before=copy.deepcopy(d); r=build(d)
        self.assertEqual(d,before); self.assertEqual(r['remaining'],11)
        self.assertEqual(r['max_new_attempts'],11); self.assertEqual(r['daily_reserved'],2)
        self.assertEqual(r['reserved_actions'],d['reserved_actions'])
        self.assertEqual(r['arguments']['p_cursor_start']['skips'],{'held':'hold'})
        self.assertNotIn('scheduled_slot',r['arguments']['p_cursor_start'])
    def test_schedule_label_separate_from_rpc_integer(self):
        d=snapshot();d['scheduled_slot']='10:00';r=build(d)
        self.assertEqual(r['arguments']['p_slot'],0)
        self.assertEqual(r['arguments']['p_cursor_start']['scheduled_slot'],'10:00')
    def test_shared_capacity_bounds_remaining(self):
        d=snapshot();d['budget']['confirmed']=57;r=build(d)
        self.assertEqual(r['max_new_attempts'],1);self.assertEqual(r['remaining'],11)
    def test_healthy_owner_defers(self):
        d=snapshot();d['leases']=[dict(status='running',expires_at='2026-10-11T07:41:00Z')]
        with self.assertRaisesRegex(ValueError,'unexpired owner'):build(d)
    def test_expired_interrupted_segment_does_not_block_fresh(self):
        d=snapshot();d['leases']=[dict(status='interrupted',expires_at='2026-10-11T07:06:51Z')]
        self.assertEqual(build(d)['arguments']['p_run_id'],'manual-base-seg5')
    def test_snapshot_and_claims_fail_closed(self):
        for key,value in [('complete',False),('active_claims_clear',False),('observed_at','2026-10-11T07:35:00Z')]:
            d=snapshot();d[key]=value
            with self.assertRaises(ValueError):build(d)
    def test_hard_stops_are_preserved(self):
        for key in ('access_denied','account_restriction','unknown_outcome'):
            d=snapshot();d[key]=True
            with self.assertRaisesRegex(ValueError,'hard stop'):build(d)
    def test_stale_wrong_account_and_flat_binding_rejected(self):
        for key,value in [('verified_at','2026-10-11T07:30:00Z'),('account','other'),('url','https://instagram.com.evil/')]:
            d=snapshot();d['browser_surface'][key]=value
            with self.assertRaises(ValueError):build(d)
        d=snapshot();d['browser_surface']={}
        with self.assertRaises(ValueError):build(d)
    def test_midnight_and_cap_do_not_expand_quota(self):
        for key,value in [('day','2026-10-10'),('cap',100),('confirmed',58)]:
            d=snapshot();d['budget'][key]=value
            with self.assertRaises(ValueError):build(d)
    def test_completed_or_reset_base_rejected(self):
        d=snapshot();d['confirmed']=20
        with self.assertRaises(ValueError):build(d)
        d=snapshot();d['run_id']='other-seg1'
        with self.assertRaises(ValueError):build(d)
    def test_duplicate_or_missing_canonical_receipts_rejected(self):
        for ids in [['x']*9, ['x']]:
            d=snapshot();d['canonical_ids']=ids
            with self.assertRaises(ValueError):build(d)
    def test_manual_cannot_inherit_schedule_credit(self):
        d=snapshot();d['cursor']['scheduled_slot']='10:00'
        with self.assertRaisesRegex(ValueError,'manual run'):build(d)
    def test_authorized_daily_goal_continues_after_twenty_without_reset(self):
        d=snapshot();d.update(target=60,goal_contract='daily-sixty-contract-20261014',confirmed=20)
        d['canonical_ids']=[str(i) for i in range(20)]
        before=copy.deepcopy(d);r=build(d)
        self.assertEqual(d,before)
        self.assertEqual(r['arguments']['p_cursor_start']['confirmed'],20)
        self.assertEqual(r['arguments']['p_cursor_start']['target'],60)
        self.assertEqual(r['remaining'],40)
        self.assertEqual(r['max_new_attempts'],29)
        self.assertEqual(r['canonical_ids'],d['canonical_ids'])
    def test_daily_goal_requires_explicit_contract_and_supported_target(self):
        for target in (60,61,0,True):
            d=snapshot();d['target']=target
            with self.assertRaises(ValueError):build(d)
    def test_daily_goal_preserves_shared_reservations_and_cap(self):
        d=snapshot();d.update(target=60,goal_contract='daily-sixty-contract-20261014')
        d['budget']['confirmed']=57
        self.assertEqual(build(d)['max_new_attempts'],1)
        d['budget']['confirmed']=58
        with self.assertRaisesRegex(ValueError,'no remaining'):build(d)
    def test_prior_day_logical_counts_cannot_exceed_fresh_daily_ledger(self):
        d=snapshot();d.update(target=60,goal_contract='daily-sixty-contract-20261014',confirmed=20)
        d['budget']['confirmed']=12;d['canonical_ids']=[str(i) for i in range(20)]
        with self.assertRaisesRegex(ValueError,'current-day shared'):build(d)

if __name__ == '__main__':unittest.main()

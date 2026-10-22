import unittest
from test_story_shift_request import snapshot
from story_shift_request import build
class ScopeTests(unittest.TestCase):
    def sample(self):
        d=snapshot();d.update(active_claims_clear=False,active_claims_complete=True,active_claims=[dict(id='a',owner='dm_manager',action_type='reply_inbound',ig_username='unrelated',thread_id='t',claim_run_id='reactive',claim_expires_at='2026-10-11T07:41:00Z')]);return d
    def test_reactive_recipient_excluded_without_blocking_start(self):
        d=self.sample();r=build(d);self.assertEqual(r['arguments']['p_cursor_start']['recipient_claim_exclusions'],d['active_claims'])
    def test_incomplete_inventory_blocks(self):
        d=self.sample();d['active_claims_complete']=False
        with self.assertRaises(ValueError):build(d)
    def test_proactive_unknown_missing_identity_block(self):
        for key,value in [('owner','browser_dispatcher'),('action_type','story_reply'),('ig_username',''),('thread_id','')]:
            d=self.sample();d['active_claims'][0][key]=value
            with self.assertRaises(ValueError):build(d)
    def test_mbs_lease_does_not_block(self):
        d=self.sample();d['leases']=[dict(status='running',expires_at='2026-10-11T07:41:00Z',browser_surface=dict(kind='meta_business_suite'))];build(d)
    def test_instagram_and_unknown_lease_block(self):
        for kind in ('instagram','unknown'):
            d=self.sample();d['leases']=[dict(status='running',expires_at='2026-10-11T07:41:00Z',browser_surface=dict(kind=kind))]
            with self.assertRaises(ValueError):build(d)
if __name__=='__main__':unittest.main()

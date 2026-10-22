import unittest
from test_story_shift_request import snapshot
from story_shift_request import build

class OutreachTests(unittest.TestCase):
    def sample(self):
        d=snapshot()
        d['leases']=[dict(run_id='outreach',lane='plant_based_discovery_follows',
            status='running',expires_at='2026-10-11T07:41:00Z',
            browser_surface=dict(kind='instagram',browser_id='3',tab_id='outreach',account='shan_n_sunny'))]
        d.update(active_claims_complete=True,active_claims=[dict(id='follow',owner='discovery_operator',
            action_type='discovery_follow',ig_username='example',claim_run_id='outreach',
            claim_expires_at='2026-10-11T07:41:00Z')])
        return d
    def test_parallel_recipient_excluded(self):
        d=self.sample()
        self.assertEqual(build(d)['arguments']['p_cursor_start']['recipient_claim_exclusions'],d['active_claims'])
    def test_same_tab_rejected(self):
        d=self.sample();d['leases'][0]['browser_surface']['tab_id']='fresh'
        with self.assertRaises(ValueError):build(d)
    def test_unmatched_claim_rejected(self):
        d=self.sample();d['active_claims'][0]['claim_run_id']='unknown'
        with self.assertRaises(ValueError):build(d)
    def test_wrong_lane_rejected(self):
        d=self.sample();d['leases'][0]['lane']='active_client_instagram_community'
        with self.assertRaises(ValueError):build(d)
    def test_wrong_account_rejected(self):
        d=self.sample();d['leases'][0]['browser_surface']['account']='wrong'
        with self.assertRaises(ValueError):build(d)
    def test_missing_identity_rejected(self):
        d=self.sample();d['active_claims'][0]['ig_username']=''
        with self.assertRaises(ValueError):build(d)

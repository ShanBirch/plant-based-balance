import test from 'node:test';
import assert from 'node:assert/strict';
import {ownContentInsights} from '../scripts/ig-own-content-insights.mjs';
const base=events=>({window:{start:'2026-11-01T00:00:00Z',end:'2026-12-01T00:00:00Z'},
 asOf:'2026-11-15T00:00:00Z',ownContentInteractions:events});
const event=(id,extra={})=>({eventId:id,handle:'a_person',contentKey:'native-story:123',
 contentType:'story',at:'2026-11-14T00:00:00Z',kind:'view',source:'native_viewer_snapshot',
 evidenceRef:'native-row',...extra});
test('repeated viewer snapshots count one Story and retain exact liked content',()=>{
 const r=ownContentInsights(base([event('a'),event('b',{storyLiked:true,likeEvidence:'heart-proof',
 contentDescription:'Sunshine in the garden'}),event('b',{storyLiked:true,likeEvidence:'heart-proof',
 contentDescription:'Sunshine in the garden'}),event('c',{contentKey:'native-story:456'})]));
 assert.equal(r.people[0].distinctStoriesViewed,2);
 assert.equal(r.people[0].distinctStoriesLiked,1);
 assert.equal(r.people[0].contents.find(c=>c.storyLiked).contentDescription,'Sunshine in the garden');
});
test('unknown likes and mismatched native/API source IDs are never guessed',()=>{
 const r=ownContentInsights(base([event('a',{storyLiked:true}),event('b',{contentKey:'content-item:other',
 kind:'story_reply',source:'content_interaction'})]));
 assert.equal(r.people[0].distinctStoriesLiked,0);
 assert.equal(r.people[0].contents.length,2);
 assert.equal(r.people[0].contents.find(c=>c.viewed).storyLiked,null);
 assert.equal(r.people[0].storyReplyEvents,1);
});
test('historical observations outside rolling window and conflicting receipts are rejected',()=>{
 assert.equal(ownContentInsights(base([event('a',{at:'2026-10-01T00:00:00Z'})])).people.length,0);
 assert.throws(()=>ownContentInsights(base([event('a'),event('a',{handle:'other'})])),/Conflicting/);
});

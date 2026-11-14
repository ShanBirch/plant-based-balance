// Passive audience evidence is separate from human replies and buying intent.
export function ownContentInsights(input) {
  const window=input.outreachWindow || input.window;
  const start=Date.parse(window.start), end=Math.min(Date.parse(window.end),
    Date.parse(input.asOf || new Date().toISOString()));
  const seen=new Map(), people=new Map(); let excluded=0;
  for(const e of input.ownContentInteractions || []){
    const handle=String(e.handle || '').replace(/^@/,'').trim().toLowerCase();
    const at=Date.parse(e.at);
    if(!e.eventId || !e.contentKey || !e.evidenceRef || !/^[a-z0-9_.]{1,30}$/.test(handle) ||
      !['view','story_reply','post_comment','post_like'].includes(e.kind) ||
      !['native_viewer_snapshot','content_interaction','native_review'].includes(e.source) ||
      !Number.isFinite(at) || at<start || at>=end){excluded++;continue;}
    const sig=JSON.stringify([handle,e.contentKey,e.kind,at]);
    if(seen.has(e.eventId)){
      if(seen.get(e.eventId)!==sig)throw Error('Conflicting own-content evidence');
      continue;
    }
    seen.set(e.eventId,sig);
    const p=people.get(handle)||{handle,contents:new Map()};
    const c=p.contents.get(e.contentKey)||{contentKey:e.contentKey,
      contentDescription:e.contentDescription || null,contentType:e.contentType || 'unknown',
      postedAt:e.postedAt || null,firstObservedAt:e.at,lastObservedAt:e.at,
      viewed:false,storyLiked:null,storyReplies:0,postComments:0,postLiked:false,evidenceRefs:[]};
    if(e.contentDescription)c.contentDescription=e.contentDescription;
    if(e.kind==='view') {
      c.viewed=true;
      // A recorded heart needs its own exact native-row evidence. Missing is unknown.
      if(e.storyLiked===true && e.likeEvidence)c.storyLiked=true;
      else if(e.storyLiked===false && e.likeEvidence && c.storyLiked!==true)c.storyLiked=false;
    }
    if(e.kind==='story_reply')c.storyReplies++;
    if(e.kind==='post_comment')c.postComments++;
    if(e.kind==='post_like')c.postLiked=true;
    if(at<Date.parse(c.firstObservedAt))c.firstObservedAt=e.at;
    if(at>Date.parse(c.lastObservedAt))c.lastObservedAt=e.at;
    c.evidenceRefs.push(e.evidenceRef);
    c.evidenceRefs=[...new Set(c.evidenceRefs)];
    p.contents.set(e.contentKey,c);people.set(handle,p);
  }
  const rows=[...people.values()].map(p=>{
    const contents=[...p.contents.values()].sort((a,b)=>Date.parse(b.lastObservedAt)-Date.parse(a.lastObservedAt));
    return {handle:p.handle,distinctStoriesViewed:contents.filter(c=>c.viewed).length,
      distinctStoriesLiked:contents.filter(c=>c.storyLiked===true).length,
      storyReplyEvents:contents.reduce((sum,c)=>sum+c.storyReplies,0),
      postCommentEvents:contents.reduce((sum,c)=>sum+c.postComments,0),
      lastObservedAt:contents[0].lastObservedAt,contents};
  }).sort((a,b)=>b.distinctStoriesLiked-a.distinctStoriesLiked ||
    b.storyReplyEvents-a.storyReplyEvents || b.distinctStoriesViewed-a.distinctStoriesViewed ||
    a.handle.localeCompare(b.handle));
  return {schema:'ig_own_content_insights_v1',window,coverage:'partial_observed_lower_bound',
    latestObservation:rows.length?rows.map(p=>p.lastObservedAt).sort((a,b)=>Date.parse(a)-Date.parse(b)).at(-1):null,
    excludedEvents:excluded,people:rows,
    limitations:['Views and likes indicate content attention, not challenge consent or a message needing a reply.',
      'Exact content keys only. Native and API IDs must not be merged by recency.',
      'Missing hearts, viewers, content descriptions or observation intervals are unknown.',
      'Reply/comment events are source metadata until human/native context is reviewed.']};
}

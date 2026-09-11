const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../dashboard.html'),'utf8');
test('feed composer wraps actions and centres the non-shrinking Post label',()=>{
 const actions=html.match(/\.feed-composer-actions \{([^}]+)\}/)[1];
 assert.match(actions,/flex-wrap: wrap/);
 const post=html.match(/#feed-composer-post-btn \{([^}]+)\}/)[1];
 for(const rule of ['display: inline-flex','align-items: center','justify-content: center','flex: 0 0 auto','box-sizing: border-box','white-space: nowrap']) assert.ok(post.includes(rule),rule);
 assert.match(html,/#feed-composer-text \{[^}]*box-sizing: border-box/);
});
test('inline comment input yields space to Post on small phones',()=>{
 assert.match(html,/input\[id\^="feed-comment-input-"\] \{[^}]*flex: 1 1 0% !important;[^}]*width: 0;[^}]*min-width: 0/);
 assert.match(html,/button\[id\^="feed-comment-btn-"\] \{[^}]*justify-content: center;[^}]*flex: 0 0 auto;[^}]*min-width: 44px/);
 assert.match(html,/id="feed-composer-post-btn" onclick="submitFeedComposerPost\(\)" disabled>Post/);
});

const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
test('story introduction follows the portrait and precedes the timeline',()=>{
 const html=fs.readFileSync('journey.html','utf8');
 const picture=html.indexOf('src="photos/shannon-portrait.jpg"');
 const intro=html.indexOf('I was plant-based from birth, raised');
 assert.ok(picture<intro);assert.ok(intro<html.indexOf('How it unfolded'));
 assert.equal(html.split('I was plant-based from birth, raised').length-1,1);
});

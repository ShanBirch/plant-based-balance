const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
test('story portrait leads to timeline without the introductory paragraph',()=>{
 const html=fs.readFileSync('journey.html','utf8');
 const picture=html.indexOf('src="photos/shannon-portrait.jpg"');
 assert.ok(picture>=0);assert.ok(picture<html.indexOf('How it unfolded'));
 assert.ok(!html.includes('I was plant-based from birth, raised'));
 assert.ok(!html.includes('journey-introduction'));
});

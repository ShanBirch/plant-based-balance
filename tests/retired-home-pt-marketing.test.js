const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
test('retired home-visit links stop before any booking request or form setup',()=>{
 const destinations=[];vm.runInNewContext(fs.readFileSync('booking.js','utf8'),{URLSearchParams,window:{location:{search:'?source=home_pt&home_pt_package=balance',replace:url=>destinations.push(url)}}});
 assert.deepEqual(destinations,['/coaching']);
});
test('public Balance pages remove home visits and keep independent online coaching',()=>{
 for(const file of ['bio.html','coaching.html','book.html'])assert.doesNotMatch(fs.readFileSync(file,'utf8'),/home-pt|home_pt|Home PT|at your home|come to you|home personal training/i);
 const s=fs.readFileSync('coaching.html','utf8');assert.match(s,/\$75<small> AUD \/ week/);assert.match(s,/Zoom Personal Training/);assert.match(s,/workout program updated weekly/);
});

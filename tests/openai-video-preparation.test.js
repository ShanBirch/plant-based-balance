const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const {promisify} = require('node:util');
const run = promisify(require('node:child_process').execFile);
const {decodeVideo,prepareVideoForOpenAI} = require('../netlify/functions/_lib/openai-video');
const binary = process.env.BALANCE_TEST_FFMPEG;

test('real video frames and audio are prepared safely for OpenAI', {skip:!binary}, async t => {
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'balance-video-test-'));
  try {
    const silent=path.join(root,'silent.mp4'), spoken=path.join(root,'audio.mp4');
    await run(binary,['-hide_banner','-f','lavfi','-i','color=red:size=320x240:rate=10','-t','2','-c:v','libx264','-pix_fmt','yuv420p',silent],{windowsHide:true});
    await run(binary,['-hide_banner','-i',silent,'-f','lavfi','-i','sine=frequency=440:duration=2','-c:v','copy','-c:a','aac','-shortest',spoken],{windowsHide:true});
    const inline=async file=>({mimeType:'video/mp4',data:(await fs.readFile(file)).toString('base64')});
    await t.test('silent clip has real JPEG frames and does not request transcription',async()=>{
      const result=await decodeVideo(await inline(silent),{binary,transcribe:()=>{throw Error('silent clip must not transcribe');}});
      assert.equal(result.hasAudio,false); assert.ok(result.frameCount>=1);
      const frame=result.parts.find(p=>p.inlineData);
      assert.equal(Buffer.from(frame.inlineData.data,'base64').subarray(0,2).toString('hex'),'ffd8');
    });
    await t.test('audio is extracted, transcribed once, and duplicate bytes are coalesced',async()=>{
      let calls=0;
      const video=await inline(spoken);
      const result=await prepareVideoForOpenAI([{role:'user',parts:[{inlineData:video},{inlineData:video},{text:'Answer the video.'}]}],{binary,transcribe:async audio=>{calls++;assert.equal(audio.mimeType,'audio/mpeg');assert.ok(Buffer.from(audio.data,'base64').length>500);return {text:'I need help with food consistency.'};}});
      assert.equal(calls,1); assert.equal(result.videos.length,1);
      assert.equal(result.videos[0].transcript,'I need help with food consistency.');
      assert.ok(result.contents[0].parts.some(p=>p.text==='Answer the video.'));
      assert.ok(result.contents[0].parts.every(p=>p.inlineData?.mimeType!=='video/mp4'));
    });
    await t.test('unreadable bytes fail rather than inventing video context',async()=>{
      await assert.rejects(decodeVideo({data:Buffer.from('not a video').toString('base64')},{binary}),/duration unavailable/);
    });
    await t.test('failed speech analysis does not silently produce a visual-only success',async()=>{
      await assert.rejects(decodeVideo(await inline(spoken),{binary,transcribe:async()=>({text:'',error:'unavailable'})}),/could not be transcribed/);
    });
  } finally {
    if(path.dirname(root)===path.resolve(os.tmpdir())&&path.basename(root).startsWith('balance-video-test-')) await fs.rm(root,{recursive:true,force:true});
  }
});

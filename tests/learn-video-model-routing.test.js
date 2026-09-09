const test = require('node:test');
const assert = require('node:assert/strict');
process.env.OPENAI_API_KEY = 'unit-test-only';
process.env.GEMINI_API_KEY = 'unit-test-only';
const {callGeminiFallback} = require('../netlify/functions/_lib/client-context');

test('video bytes reach Gemini even when OpenAI is the default, and failures never silently downgrade video', async () => {
  const original = global.fetch;
  const calls = [];
  let fail = false;
  global.fetch = async (url, options) => {
    calls.push(String(url));
    assert.match(String(url), /generativelanguage.googleapis.com/);
    const body = JSON.parse(options.body);
    assert.equal(body.contents[0].parts[0].inlineData.mimeType,'video/mp4');
    return new Response(JSON.stringify(fail ? {error:{message:'unavailable'}} : {candidates:[{content:{parts:[{text:'Verified video content'}]}}]}),{status:fail?400:200});
  };
  try {
    const contents=[{role:'user',parts:[{inlineData:{mimeType:'video/mp4',data:'dGVzdA=='}}]}];
    assert.equal(await callGeminiFallback(contents),'Verified video content');
    fail=true;
    await assert.rejects(callGeminiFallback(contents));
    assert.ok(calls.length>=2);
  } finally {global.fetch=original;}
});

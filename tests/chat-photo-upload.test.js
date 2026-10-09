const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('js/dashboard/dashboard-script-6-ai_coach_draft_mode_logic_auth.js', 'utf8');
const code = source.slice(source.indexOf('async function prepareChatPhoto('), source.indexOf('window.sendChatPhoto = sendChatPhoto;'));
(async () => {
 for (const chatType of ['dm', 'gc']) {
  let uploaded, inserted, revoked = false;
  const context = { console, File, FormData, URL: {createObjectURL: () => 'blob:test', revokeObjectURL: () => { revoked = true; }},
   Image: class { naturalWidth = 4032; naturalHeight = 3024; set src(value) { this.onload(); } },
   document: {getElementById: () => null, createElement: () => ({getContext: () => ({fillRect() {}, drawImage() {}}), toBlob: callback => callback(new Blob(['compressed'], {type: 'image/jpeg'}))})},
   currentDMRecipient: {id: 'original-dm'}, currentGroupChatId: 'original-group',
   window: {currentUser: {id: 'sender'}, supabaseClient: {from: () => ({insert: async row => {inserted = row; return {};}})}},
   fetch: async (url, options) => {uploaded = options.body.get('file'); context.currentDMRecipient = {id: 'other-dm'}; context.currentGroupChatId = 'other-group'; return {ok: true, json: async () => ({url: 'https://example.com/photo.jpg'})};},
   showToast: () => {throw Error('Unexpected upload failure');}, loadDirectMessages: () => {throw Error('Refreshed wrong DM');}, loadGroupChatMessages: () => {throw Error('Refreshed wrong group');}
  };
  vm.createContext(context); vm.runInContext(code, context);
  const input = {files: [new File([new Uint8Array(400000)], 'camera.png', {type: 'image/png'})], value: 'selected'};
  await context.sendChatPhoto(chatType, input);
  assert.equal(input.value, ''); assert.equal(uploaded.type, 'image/jpeg'); assert.equal(uploaded.name, 'camera.jpg'); assert.ok(uploaded.size < 400000); assert.ok(revoked);
  assert.equal(chatType === 'dm' ? inserted.receiver_id : inserted.group_chat_id, chatType === 'dm' ? 'original-dm' : 'original-group');
  assert.equal(inserted.message, '[PHOTO:https://example.com/photo.jpg]');
 }
 console.log('Chat photo compression and destination tests passed');
})().catch(error => {console.error(error);process.exitCode = 1;});

// Keep the existing playback URL available from the deployed functions directory.
export { default } from '../functions/chat-audio-proxy.mts';

export const config = { path: '/api/chat-audio' };

import { registerPlugin } from '@capacitor/core';

export const RecordingLibrary = registerPlugin<{
  saveVideo(options: { uri: string }): Promise<{ uri: string }>;
}>('RecordingLibrary');

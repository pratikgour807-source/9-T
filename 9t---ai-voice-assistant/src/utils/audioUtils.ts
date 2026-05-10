let globalAudioCtx: AudioContext | null = null;

export function getAudioContext(sampleRate: number = 24000): AudioContext {
  if (!globalAudioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    globalAudioCtx = new AudioContextClass({ sampleRate });
  }
  return globalAudioCtx;
}

export async function resumeAudio() {
  const ctx = getAudioContext();
  if (ctx.state === "suspended") {
    await ctx.resume();
  }
}

export async function playPCM(base64Data: string): Promise<void> {
  try {
    const audioCtx = getAudioContext(24000);
    await resumeAudio();
    
    const binaryString = atob(base64Data);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const buffer = new Int16Array(bytes.buffer);
    const audioBuffer = audioCtx.createBuffer(1, buffer.length, 24000);
    const channelData = audioBuffer.getChannelData(0);
    for (let i = 0; i < buffer.length; i++) {
      channelData[i] = buffer[i] / 32768.0;
    }
    const source = audioCtx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioCtx.destination);
    source.start();
    
    return new Promise<void>(resolve => {
      source.onended = () => resolve();
    });
  } catch (error) {
    console.error("Error playing audio:", error);
  }
}

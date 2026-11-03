import type { TimedWord } from './montage'

// Speech-to-text runs fully in the browser with a small Whisper model (downloaded once, then cached).
const LIB = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.0.2'
const MODEL = 'Xenova/whisper-tiny.en'

let pipe: Promise<any> | null = null

export async function transcribe(url: string, onStatus: (s: string) => void): Promise<TimedWord[]> {
  onStatus('Getting your audio…')
  const buf = await (await fetch(url)).arrayBuffer()
  const ctx = new OfflineAudioContext(1, 16000, 16000)
  const audio = await ctx.decodeAudioData(buf)
  let samples = audio.getChannelData(0)
  if (audio.numberOfChannels > 1) {
    const r = audio.getChannelData(1)
    samples = samples.map((v, i) => (v + r[i]) / 2)
  }
  if (!pipe) {
    onStatus('Loading the caption robot (~40 MB, only the first time)…')
    pipe = import(/* @vite-ignore */ LIB).then((m: any) =>
      m.pipeline('automatic-speech-recognition', MODEL, {
        progress_callback: (p: any) => {
          if (p.status === 'progress' && p.file?.endsWith('.onnx')) onStatus(`Loading the caption robot… ${Math.round(p.progress)}%`)
        },
      }),
    )
    pipe.catch(() => (pipe = null))
  }
  const asr = await pipe
  onStatus('Listening to your clip…')
  const out = await asr(samples, { return_timestamps: 'word', chunk_length_s: 30, stride_length_s: 5 })
  const words: TimedWord[] = (out.chunks ?? [])
    .map((c: any) => ({ text: String(c.text).trim(), t: c.timestamp?.[0] ?? 0 }))
    .filter((w: TimedWord) => w.text)
  return words
}

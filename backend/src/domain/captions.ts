// Captions for an audio sheet (WCAG 1.2.1). The recording duration is unknown, so cues
// follow a reading pace; the text is the French sheet the voice-over was made from.
export const CHARS_PER_SECOND = 15;
export const MIN_CUE_SECONDS = 2;

const pad = (n: number, w = 2) => String(n).padStart(w, '0');
const stamp = (s: number) =>
  `${pad(Math.floor(s / 3600))}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}.000`;
// A cue must not contain "-->" nor a blank line, or the player would read a new cue.
const clean = (t: string) =>
  t.replace(/\s+/g, ' ').replace(/-->/g, '->').trim();

export function toWebVtt(title: string, body: string): string {
  const lines = [title, ...body.split(/(?<=[.!?])\s+/)]
    .map(clean)
    .filter(Boolean);
  let at = 0;
  const cues = lines.map((text, i) => {
    const len = Math.max(
      MIN_CUE_SECONDS,
      Math.ceil(text.length / CHARS_PER_SECOND),
    );
    const cue = `${i + 1}\n${stamp(at)} --> ${stamp(at + len)}\n${text}`;
    at += len;
    return cue;
  });
  return `WEBVTT\n\n${cues.join('\n\n')}\n`;
}

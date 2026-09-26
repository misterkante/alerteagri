import { toWebVtt, CHARS_PER_SECOND, MIN_CUE_SECONDS } from './captions';

const cues = (vtt: string) => vtt.split('\n\n').slice(1).filter(Boolean);

describe('captions (F-08, WCAG 1.2.1)', () => {
  it('starts with the WEBVTT header and one cue per sentence, title first', () => {
    const vtt = toWebVtt(
      'Semis du maïs',
      'Attendez 20 mm de pluie. Semez ensuite.',
    );
    expect(vtt.startsWith('WEBVTT\n\n')).toBe(true);
    const c = cues(vtt);
    expect(c).toHaveLength(3);
    expect(c[0]).toBe('1\n00:00:00.000 --> 00:00:02.000\nSemis du maïs');
    expect(c[1].split('\n')[2]).toBe('Attendez 20 mm de pluie.');
    expect(c[2].split('\n')[2]).toBe('Semez ensuite.');
  });

  it('chains cues without gap and times them at the reading pace', () => {
    const sentence = 'a'.repeat(CHARS_PER_SECOND * 4 - 1) + '.';
    const c = cues(toWebVtt('T', sentence));
    expect(c[1].split('\n')[1]).toBe('00:00:02.000 --> 00:00:06.000');
  });

  it('never shows a cue shorter than the minimum', () => {
    const c = cues(toWebVtt('T', 'Oui.'));
    expect(c[1].split('\n')[1]).toBe(
      `00:00:02.000 --> 00:00:0${2 + MIN_CUE_SECONDS}.000`,
    );
  });

  it('formats minutes and hours', () => {
    const long = Array.from(
      { length: 50 },
      () => 'b'.repeat(CHARS_PER_SECOND * 3 - 1) + '.',
    ).join(' ');
    const last = cues(toWebVtt('T', long)).at(-1)!;
    expect(last.split('\n')[1]).toBe('00:02:29.000 --> 00:02:32.000');
  });

  it('keeps line breaks out of cue text and skips empty sentences', () => {
    const c = cues(toWebVtt('T', 'Un.\n\nDeux !   Trois ?'));
    expect(c.map((x) => x.split('\n')[2])).toStrictEqual([
      'T',
      'Un.',
      'Deux !',
      'Trois ?',
    ]);
  });

  it('ignores trailing blanks and collapses inner ones', () => {
    const c = cues(toWebVtt('T', 'Un   mot.  '));
    expect(c.map((x) => x.split('\n')[2])).toStrictEqual(['T', 'Un mot.']);
  });

  it('cannot be broken by a cue separator inside the text', () => {
    const vtt = toWebVtt('T', 'Avant --> après.');
    expect(cues(vtt)[1].split('\n')[2]).toBe('Avant -> après.');
  });
});

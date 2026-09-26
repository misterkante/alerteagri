import { Langues229Provider, VoiceUnavailableError } from './voice.provider';

const env = { LANGUES229_API_KEY: 'key-123', LANGUES229_BEARER: 'bearer-456' };
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

describe('229langues voice provider', () => {
  it('refuses to call anything without both keys', async () => {
    const fetcher = jest.fn();
    const p = new Langues229Provider({ LANGUES229_API_KEY: 'k' }, fetcher);
    await expect(p.synthesize('Ku do', 'fon')).rejects.toThrow(
      VoiceUnavailableError,
    );
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('sends both credentials and the documented body to the speech route', async () => {
    const wav = Buffer.from('RIFF0000WAVEfmt ');
    const fetcher = jest.fn().mockResolvedValue(new Response(wav));
    const audio = await new Langues229Provider(env, fetcher).synthesize(
      'Ku do',
      'fon',
    );
    expect(audio.equals(wav)).toBe(true);
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe('https://ronaldodev-api.hf.space/api/v1/tts');
    expect(init.headers).toStrictEqual({
      Authorization: 'Bearer bearer-456',
      'X-API-Key': 'key-123',
      'Content-Type': 'application/json',
    });
    expect(JSON.parse(init.body)).toStrictEqual({
      text: 'Ku do',
      language: 'fon',
    });
  });

  it('translates from French with the provider code of the language', async () => {
    const fetcher = jest
      .fn()
      .mockResolvedValue(json({ success: true, data: { text: 'Ẹ kú àárọ̀' } }));
    const text = await new Langues229Provider(env, fetcher).translate(
      'Bonjour',
      'yoruba',
    );
    expect(text).toBe('Ẹ kú àárọ̀');
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toMatchObject({
      text: 'Bonjour',
      from_lang: 'fr',
      to_lang: 'yo',
    });
  });

  it('rejects a translation that only echoes the French text', async () => {
    const fetcher = jest
      .fn()
      .mockResolvedValue(json({ success: true, data: { text: 'Bonjour' } }));
    await expect(
      new Langues229Provider(env, fetcher).translate('Bonjour', 'fon'),
    ).rejects.toThrow('Traduction indisponible');
  });

  it('turns an HTTP error or a network failure into an explicit error', async () => {
    const down = jest.fn().mockResolvedValue(json({}, 503));
    await expect(
      new Langues229Provider(env, down).synthesize('x', 'fon'),
    ).rejects.toThrow('HTTP 503');
    const offline = jest.fn().mockRejectedValue(new TypeError('fetch failed'));
    await expect(
      new Langues229Provider(env, offline).synthesize('x', 'fon'),
    ).rejects.toThrow('injoignable');
  });
});

// Speech in local languages for sheets that no one has recorded yet.
export interface VoiceProvider {
  readonly name: string;
  // Our language codes this provider can speak.
  readonly voices: readonly string[];
  translate(frenchText: string, lang: string): Promise<string>;
  synthesize(text: string, lang: string): Promise<Buffer>;
}

export const VOICE_PROVIDER = 'VOICE_PROVIDER';

// Raised when the provider is not configured, unreachable or answers something unusable.
export class VoiceUnavailableError extends Error {}

const BASE_URL = 'https://ronaldodev-api.hf.space/api/v1';
// Our codes to the translation codes of the provider.
const TRANSLATION_CODE: Record<string, string> = { fon: 'fon', yoruba: 'yo' };
const TIMEOUT_MS = 90_000;

// 229langues (api229langues.vercel.app): Fon and Yoruba speech models from a developer in Cotonou.
// Keys come from the environment only; the platform works without them, minus this button.
export class Langues229Provider implements VoiceProvider {
  readonly name = '229langues';
  readonly voices = ['fon', 'yoruba'] as const;

  constructor(
    private readonly env: NodeJS.ProcessEnv = process.env,
    private readonly fetcher: typeof fetch = (input, init) =>
      fetch(input, init),
  ) {}

  async translate(frenchText: string, lang: string): Promise<string> {
    const res = await this.call('/translate', {
      text: frenchText,
      from_lang: 'fr',
      to_lang: TRANSLATION_CODE[lang],
      save_to_cache: true,
    });
    const body = (await res.json()) as {
      success?: boolean;
      data?: { text?: string };
    };
    const text = body.data?.text?.trim();
    if (!body.success || !text || text === frenchText.trim())
      throw new VoiceUnavailableError('Traduction indisponible');
    return text;
  }

  async synthesize(text: string, lang: string): Promise<Buffer> {
    const res = await this.call('/tts', { text, language: lang });
    return Buffer.from(await res.arrayBuffer());
  }

  private async call(path: string, payload: object): Promise<Response> {
    const key = this.env.LANGUES229_API_KEY;
    const bearer = this.env.LANGUES229_BEARER;
    if (!key || !bearer)
      throw new VoiceUnavailableError('Service de voix non configuré');
    let res: Response;
    try {
      res = await this.fetcher(`${BASE_URL}${path}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${bearer}`,
          'X-API-Key': key,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch {
      throw new VoiceUnavailableError('Service de voix injoignable');
    }
    if (!res.ok)
      throw new VoiceUnavailableError(
        `Service de voix en erreur (HTTP ${res.status})`,
      );
    return res;
  }
}

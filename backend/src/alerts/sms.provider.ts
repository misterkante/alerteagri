export interface SmsProvider {
  readonly name: string;
  send(phone: string, body: string): Promise<void>;
}

// Demo channel: messages are stored and shown in the outbox, nothing leaves the platform.
export class InternalOutboxProvider implements SmsProvider {
  readonly name = 'boîte d’envoi interne (démo)';
  async send(): Promise<void> {}
}

export const SMS_PROVIDER = 'SMS_PROVIDER';

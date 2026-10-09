/** Injection token for the active SMS provider implementation. */
export const SMS_PROVIDER = Symbol('SMS_PROVIDER');

export type SmsMessage = {
  /** E.164 / 255XXXXXXXXX recipient. */
  to: string;
  body: string;
};

export interface SmsProvider {
  send(message: SmsMessage): Promise<void>;
}

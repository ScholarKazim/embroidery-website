import { ISmsProvider, SmsSendResult } from './sms-provider.interface.js';
import { config } from '../../config/index.js';

export class TwilioSmsProvider implements ISmsProvider {
  readonly name = 'twilio';

  async sendOtp(phoneNumber: string, code: string, messageTemplate?: string): Promise<SmsSendResult> {
    const { accountSid, authToken, fromNumber } = config.sms.twilio;
    if (!accountSid || !authToken || !fromNumber) {
      throw new Error('Twilio configuration is incomplete (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER)');
    }

    const body = messageTemplate ? messageTemplate.replace('{code}', code) : `إبرة وخيط - رمز التحقق لتصويت ألوان الدفعة هو: ${code}`;

    try {
      const authHeader = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
      const params = new URLSearchParams();
      params.append('To', phoneNumber);
      params.append('From', fromNumber);
      params.append('Body', body);

      const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${authHeader}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });

      const data = (await response.json()) as { sid?: string; message?: string; status?: string };

      if (!response.ok) {
        return {
          success: false,
          provider: this.name,
          error: data.message || `Twilio HTTP Error ${response.status}`,
        };
      }

      return {
        success: true,
        messageId: data.sid,
        provider: this.name,
      };
    } catch (err: any) {
      return {
        success: false,
        provider: this.name,
        error: err?.message || 'Twilio connection failed',
      };
    }
  }
}

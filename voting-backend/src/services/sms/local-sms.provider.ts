import { ISmsProvider, SmsSendResult } from './sms-provider.interface.js';
import { config } from '../../config/index.js';

export class LocalGatewaySmsProvider implements ISmsProvider {
  readonly name = 'local_gateway';

  async sendOtp(phoneNumber: string, code: string, messageTemplate?: string): Promise<SmsSendResult> {
    const { apiUrl, apiKey, senderId } = config.sms.localGateway;
    if (!apiUrl || !apiKey) {
      throw new Error('Local SMS Gateway configuration missing (LOCAL_SMS_API_URL, LOCAL_SMS_API_KEY)');
    }

    const message = messageTemplate ? messageTemplate.replace('{code}', code) : `رمز التحقق لتصويت ألوان دفعتك: ${code}`;

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          recipient: phoneNumber,
          sender: senderId,
          text: message,
        }),
      });

      const data = (await response.json()) as { success?: boolean; id?: string; error?: string };

      if (!response.ok || data.success === false) {
        return {
          success: false,
          provider: this.name,
          error: data.error || `Gateway returned HTTP ${response.status}`,
        };
      }

      return {
        success: true,
        messageId: data.id,
        provider: this.name,
      };
    } catch (err: any) {
      return {
        success: false,
        provider: this.name,
        error: err?.message || 'Local SMS Gateway network failure',
      };
    }
  }
}

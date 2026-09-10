import { ISmsProvider, SmsSendResult } from './sms-provider.interface.js';

export class MockSmsProvider implements ISmsProvider {
  readonly name = 'mock';

  async sendOtp(phoneNumber: string, code: string, messageTemplate?: string): Promise<SmsSendResult> {
    const text = messageTemplate ? messageTemplate.replace('{code}', code) : `رمز التحقق الخاص بك هو: ${code}`;
    
    console.log('\n========================================');
    console.log(`[DEV SMS GATEWAY] To: ${phoneNumber}`);
    console.log(`[DEV SMS GATEWAY] Content: "${text}"`);
    console.log(`[DEV SMS GATEWAY] OTP CODE: >>> ${code} <<<`);
    console.log('========================================\n');

    return {
      success: true,
      messageId: `mock-msg-${Date.now()}`,
      provider: this.name,
    };
  }
}

export interface SmsSendResult {
  success: boolean;
  messageId?: string;
  provider: string;
  error?: string;
}

export interface ISmsProvider {
  readonly name: string;
  sendOtp(phoneNumber: string, code: string, messageTemplate?: string): Promise<SmsSendResult>;
}

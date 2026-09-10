import { ISmsProvider } from './sms-provider.interface.js';
import { MockSmsProvider } from './mock-sms.provider.js';
import { TwilioSmsProvider } from './twilio-sms.provider.js';
import { LocalGatewaySmsProvider } from './local-sms.provider.js';
import { config } from '../../config/index.js';

let activeProvider: ISmsProvider | null = null;

export function getSmsProvider(): ISmsProvider {
  if (activeProvider) return activeProvider;

  const providerName = config.sms.provider.toLowerCase();

  switch (providerName) {
    case 'twilio':
      activeProvider = new TwilioSmsProvider();
      break;
    case 'local_gateway':
      activeProvider = new LocalGatewaySmsProvider();
      break;
    case 'mock':
    default:
      activeProvider = new MockSmsProvider();
      break;
  }

  return activeProvider;
}

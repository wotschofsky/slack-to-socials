import NDK, {
  NDKEvent,
  NDKPrivateKeySigner,
} from 'https://esm.sh/@nostr-dev-kit/ndk';

import { SocialClient } from './base-social.ts';

const DEFAULT_RELAY_URLS = [
  'wss://relay.damus.io',
  'wss://nostr.lu.ke',
  'wss://relay.camelus.app',
  'wss://strfry.iris.to',
];

export class NostrClient extends SocialClient {
  public override readonly name = 'Nostr';

  private ndk: NDK;

  // Initialize the NDK instance
  constructor() {
    super();

    this.ndk = new NDK({
      explicitRelayUrls: DEFAULT_RELAY_URLS,
    });
  }

  public override async init() {
    await this.ndk.connect();
  }

  async post(text: string): Promise<{ success: boolean; message: string }> {
    try {
      // Get the NSEC from environment variables
      const nsec = Deno.env.get('NOSTR_NSEC')!;

      if (!nsec) {
        throw new Error('NOSTR_NSEC environment variable is not set');
      }

      // Create a signer from the private key (NSEC)
      const signer = new NDKPrivateKeySigner(nsec);

      // Create a new event
      const event = new NDKEvent(this.ndk);
      event.kind = 1; // Set kind to 1 for text notes
      event.content = text;

      // Sign and publish the event
      await event.sign(signer);
      await event.publish();

      return {
        success: true,
        message: 'Message posted successfully to nostr network',
      };
    } catch (error) {
      console.error('Error posting to Nostr:', error);
      return { success: false, message: `Error: ${error}` };
    }
  }
}

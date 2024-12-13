import NDK, { NDKEvent } from "https://esm.sh/@nostr-dev-kit/ndk";
import { NDKPrivateKeySigner } from "https://esm.sh/@nostr-dev-kit/ndk";

// Global NDK instance
let globalNDK: NDK | null = null;

const DEFAULT_RELAY_URLS = [
  "wss://relay.damus.io",
  "wss://nostr.lu.ke",
  "wss://relay.camelus.app",
  "wss://strfry.iris.to",
];

// Function to initialize the global NDK instance
async function initializeNDK(): Promise<NDK> {
  if (!globalNDK) {
    globalNDK = new NDK({
      explicitRelayUrls: DEFAULT_RELAY_URLS,
    });
    await globalNDK.connect();
  }
  return globalNDK;
}

export async function postToNostr(
  text: string
): Promise<{ success: boolean; message: string }> {
  try {
    // Get the NSEC from environment variables
    const nsec = Deno.env.get("NOSTR_NSEC")!;

    if (!nsec) {
      throw new Error("NOSTR_NSEC environment variable is not set");
    }

    // Initialize or get the global NDK instance
    const ndk = await initializeNDK();

    // Create a signer from the private key (NSEC)
    const signer = new NDKPrivateKeySigner(nsec);

    // Create a new event
    const event = new NDKEvent(ndk);
    event.kind = 1; // Set kind to 1 for text notes
    event.content = text;

    // Sign and publish the event
    await event.sign(signer);
    await event.publish();

    return {
      success: true,
      message: "Message posted successfully to nostr network",
    };
  } catch (error) {
    console.error("Error posting to Nostr:", error);
    return { success: false, message: `Error: ${error}` };
  }
}

import { load as loadEnv } from '@std/dotenv';

import type { ConversationsHistoryResponse } from 'npm:@slack/web-api';

import { NostrClient } from './lib/nostr.ts';
import redis from './lib/redis.ts';
import { channelId, slackClient } from './lib/slack.ts';
import { TwitterClient } from './lib/twitter.ts';
import { isUnsuitableMessage, processMessage } from './lib/util/message.ts';

try {
  await loadEnv({ export: true });
} catch (error) {
  console.warn('Unable to load .env file:', error);
}

const socialClients = [new TwitterClient(), new NostrClient()];
for (const socialClient of socialClients) {
  await socialClient.init();
}

async function pollAndPost() {
  const lastTimestamp = (await redis.get('last_timestamp')) || '0';

  const result = (await slackClient.conversations.history({
    channel: channelId,
    oldest: lastTimestamp,
    limit: 1,
  })) as ConversationsHistoryResponse;

  if (!result.messages?.length) return;

  const message = result.messages[0];

  if (!message.ts || isUnsuitableMessage(message)) {
    // Skip message and set timestamp using message.ts if it exists, otherwise increment lastTimestamp
    await redis.set(
      'last_timestamp',
      message.ts || parseFloat(lastTimestamp) + 1
    );
    return;
  }

  const resolvedText = await processMessage(message.text);

  const results = await Promise.allSettled(
    socialClients.map((client) => client.post(resolvedText))
  );

  const resultsText = results
    .map((result, index) => {
      if (result.status === 'rejected')
        return `Failed posting to ${socialClients[index].name}: Redacted Error (see logs)`;
      if (!result.value.success)
        return `Failed posting to ${socialClients[index].name}: ${result.value.message}`;
      return `Successfully posted to ${socialClients[index].name}: ${result.value.message}`;
    })
    .join('\n');

  console.info(resultsText);

  try {
    await slackClient.chat.postMessage({
      channel: channelId!,
      thread_ts: message.ts,
      text: resultsText,
    });
  } catch (error) {
    console.error('Error reporting post status on Slack:', error);
  }

  await redis.set('last_timestamp', message.ts);
}

async function main() {
  while (true) {
    try {
      await pollAndPost();
    } catch (error) {
      console.error('Error while polling:', error);
    } finally {
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
}

main();

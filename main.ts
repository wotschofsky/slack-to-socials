import { load as loadEnv } from '@std/dotenv';

import type { ConversationsHistoryResponse } from 'npm:@slack/web-api';
import {
  uniqueNamesGenerator,
  adjectives,
  colors,
  animals,
} from 'npm:unique-names-generator';

import redis from './lib/redis.ts';
import { TwitterClient } from './lib/twitter.ts';
import { NostrClient } from './lib/nostr.ts';
import { channelId, slackClient } from './lib/slack.ts';

try {
  await loadEnv({ export: true });
} catch (error) {
  console.warn('Unable to load .env file:', error);
}

const socialClients = [new TwitterClient(), new NostrClient()];
for (const socialClient of socialClients) {
  await socialClient.init();
}

async function resolveUserTags(text: string): Promise<string> {
  const userTagRegex = /<@([A-Z0-9]+)>/g;
  const userTags = text.match(userTagRegex) || [];
  for (const tag of userTags) {
    const userId = tag.match(/<@([A-Z0-9]+)>/)?.[1];
    if (!userId) continue;

    let userAlias = await redis.get(`user_alias:${userId}`);
    if (!userAlias) {
      userAlias = uniqueNamesGenerator({
        dictionaries: [adjectives, colors, animals],
        style: 'capital',
        separator: ' ',
      });
      await redis.set(`user_alias:${userId}`, userAlias);
    }
    text = text.replace(tag, userAlias);
  }
  return text.replace(/\(at\)/g, '@');
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

  if (!message.ts) {
    await redis.set('last_timestamp', parseFloat(lastTimestamp) + 1);
    return;
  }

  if (
    message.type !== 'message' ||
    message.subtype !== undefined ||
    !message.text
  ) {
    await redis.set('last_timestamp', message.ts);
    return;
  }

  const resolvedText = await resolveUserTags(message.text);

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

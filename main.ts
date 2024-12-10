import '@std/dotenv/load';

import { ConversationsHistoryResponse, WebClient } from 'npm:@slack/web-api';
import {
  uniqueNamesGenerator,
  adjectives,
  colors,
  animals,
} from 'npm:unique-names-generator';

import redis from './redis.ts';
import { postToTwitter } from './twitter.ts';

const slackToken = Deno.env.get('SLACK_USER_TOKEN');
const channelId = Deno.env.get('SLACK_CHANNEL_ID');

if (!slackToken || !channelId) {
  throw new Error('Missing Slack token or channel ID');
}

const slackClient = new WebClient(slackToken);

async function resolveUserTags(text: string): Promise<string> {
  const userTagRegex = /<@([A-Z0-9]+)>/g;
  const userTags = text.match(userTagRegex) || [];
  for (const tag of userTags) {
    const randomName = uniqueNamesGenerator({
      dictionaries: [adjectives, colors, animals],
      style: 'capital',
      separator: ' ',
    });
    text = text.replace(tag, randomName);
  }
  return text;
}

async function pollSlackAndPost() {
  async function poll() {
    try {
      let lastTimestamp = (await redis.get('last_timestamp')) || '0';

      const result = (await slackClient.conversations.history({
        channel: channelId!,
        oldest: lastTimestamp,
        limit: 10,
      })) as ConversationsHistoryResponse;

      if (result.messages && result.messages.length > 0) {
        for (const message of result.messages.reverse()) {
          if (
            message.ts &&
            parseFloat(message.ts) > parseFloat(lastTimestamp)
          ) {
            if (message.text) {
              const resolvedText = await resolveUserTags(message.text);
              await postToTwitter(resolvedText);
            }
            lastTimestamp = message.ts;
          }
        }
        await redis.set('last_timestamp', lastTimestamp);
      }
    } catch (error) {
      console.error('Error in poll:', error);
    }
    // Schedule the next poll after 5 seconds
    setTimeout(poll, 5000);
  }
  // Start the polling loop
  poll();
}

async function main() {
  try {
    await pollSlackAndPost();
  } catch (error) {
    console.error('Uncaught error in main:', error);
  }
}

main().catch((error) => console.error('Error in main:', error));

import { WebClient } from 'npm:@slack/web-api';

const slackToken = Deno.env.get('SLACK_USER_TOKEN');
export const channelId = Deno.env.get('SLACK_CHANNEL_ID')!;

if (!slackToken || !channelId) {
  throw new Error('Missing Slack token or channel ID');
}

export const slackClient = new WebClient(slackToken);

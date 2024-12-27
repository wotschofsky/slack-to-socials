import { MessageElement } from 'npm:@slack/web-api';
import { adjectives, colors, animals } from 'npm:unique-names-generator';
import { uniqueNamesGenerator } from 'npm:unique-names-generator';
import emoji from 'npm:node-emoji';
import redis from '../redis.ts';

export function isUnsuitableMessage(message: MessageElement) {
  return (
    message.type !== 'message' || message.subtype !== undefined || !message.text
  );
}

export async function processMessage(text: string): Promise<string> {
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

  // Then resolve emojis
  text = emoji.emojify(text);
  
  return text.replace(/\(at\)/g, '@');
}

import { TwitterApi } from 'npm:twitter-api-v2';
import { TwitterApiAutoTokenRefresher } from 'npm:@twitter-api-v2/plugin-token-refresher';

import redis from './redis.ts';

const clientId = Deno.env.get('TWITTER_CLIENT_ID')!;
const clientSecret = Deno.env.get('TWITTER_CLIENT_SECRET')!;

async function getTokens() {
  const accessToken = await redis.get('twitter_access_token');
  const refreshToken = await redis.get('twitter_refresh_token');
  return { accessToken, refreshToken };
}

async function setTokens(accessToken: string, refreshToken: string) {
  await redis.set('twitter_access_token', accessToken);
  await redis.set('twitter_refresh_token', refreshToken);
}

const { accessToken, refreshToken } = await getTokens();

if (!accessToken || !refreshToken) {
  throw new Error('Twitter tokens not found in Redis');
}

const autoRefresherPlugin = new TwitterApiAutoTokenRefresher({
  refreshToken,
  refreshCredentials: { clientId, clientSecret },
  async onTokenUpdate(token) {
    await setTokens(token.accessToken, token.refreshToken!);
  },
  onTokenRefreshError(error) {
    console.error('Twitter token refresh error:', error);
  },
});

export const twitterClient = new TwitterApi(accessToken, {
  plugins: [autoRefresherPlugin],
});

export async function postToTwitter(
  text: string
): Promise<{ success: boolean; message: string }> {
  try {
    const tweet = await twitterClient.v2.tweet(text);
    console.log('Tweet posted successfully:', tweet.data.id);
    return {
      success: true,
      message: `https://twitter.com/user/status/${tweet.data.id}`,
    };
  } catch (error) {
    if (
      (error as Record<string, any>).data?.detail?.includes('duplicate content')
    ) {
      console.log('Tweet already posted');
      return { success: false, message: 'Tweet already posted' };
    }

    console.error('Error posting to Twitter:', error);
    if ((error as Record<string, any>).code === 429) {
      const resetTime = new Date(
        (error as Record<string, any>).rateLimit.reset * 1000
      );
      return {
        success: false,
        message: `Rate limit exceeded. Please try again in ${Math.ceil(
          (resetTime.getTime() - Date.now()) / 1000 / 60
        )} minutes.`,
      };
    }
    return { success: false, message: 'Some Other Error' };
  }
}

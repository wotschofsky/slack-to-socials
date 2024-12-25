import { TwitterApi } from 'npm:twitter-api-v2';
import { TwitterApiAutoTokenRefresher } from 'npm:@twitter-api-v2/plugin-token-refresher';

import redis from './redis.ts';

import { SocialClient } from './base-social.ts';

export class TwitterClient extends SocialClient {
  public override readonly name = 'X';

  private client: TwitterApi | null = null;

  constructor() {
    super();
  }

  public override async init() {
    const clientId = Deno.env.get('TWITTER_CLIENT_ID')!;
    const clientSecret = Deno.env.get('TWITTER_CLIENT_SECRET')!;

    const accessToken = await redis.get('twitter_access_token');
    const refreshToken = await redis.get('twitter_refresh_token');

    if (!accessToken || !refreshToken) {
      throw new Error('Twitter tokens not found in Redis');
    }

    const autoRefresherPlugin = new TwitterApiAutoTokenRefresher({
      refreshToken,
      refreshCredentials: { clientId, clientSecret },
      async onTokenUpdate({ accessToken, refreshToken }) {
        await redis.set('twitter_access_token', accessToken!);
        await redis.set('twitter_refresh_token', refreshToken!);
      },
      onTokenRefreshError(error) {
        console.error('Twitter token refresh error:', error);
      },
    });

    this.client = new TwitterApi(accessToken, {
      plugins: [autoRefresherPlugin],
    });
  }

  public async post(
    text: string
  ): Promise<{ success: boolean; message: string }> {
    if (!this.client) {
      throw new Error('TwitterClient not initialized. Call init() first.');
    }

    try {
      const tweet = await this.client.v2.tweet(text);
      console.log('Tweet posted successfully:', tweet.data.id);
      return {
        success: true,
        message: `https://twitter.com/user/status/${tweet.data.id}`,
      };
    } catch (error) {
      if (
        (error as Record<string, any>).data?.detail?.includes(
          'duplicate content'
        )
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
}

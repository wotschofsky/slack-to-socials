import '@std/dotenv/load';

import { serve } from 'https://deno.land/std@0.220.1/http/server.ts';
import { TwitterApi } from 'npm:twitter-api-v2';

const clientId = Deno.env.get('TWITTER_CLIENT_ID');
const clientSecret = Deno.env.get('TWITTER_CLIENT_SECRET');
const redirectUri = 'http://localhost:8000/callback';

if (!clientId || !clientSecret) {
  console.error(
    'Please set TWITTER_CLIENT_ID and TWITTER_CLIENT_SECRET in your .env file'
  );
  Deno.exit(1);
}

const client = new TwitterApi({ clientId, clientSecret });

let codeVerifier: string;
let state: string;

async function handleRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);

  if (url.pathname === '/') {
    const {
      url: authUrl,
      codeVerifier: newCodeVerifier,
      state: newState,
    } = client.generateOAuth2AuthLink(redirectUri, {
      scope: ['tweet.read', 'tweet.write', 'users.read', 'offline.access'],
    });
    codeVerifier = newCodeVerifier;
    state = newState;
    return new Response(`<a href="${authUrl}">Authorize with Twitter</a>`, {
      headers: { 'content-type': 'text/html' },
    });
  } else if (url.pathname === '/callback') {
    const code = url.searchParams.get('code');
    const returnedState = url.searchParams.get('state');

    if (!code || !returnedState || returnedState !== state) {
      return new Response('Invalid callback', { status: 400 });
    }

    try {
      const { accessToken, refreshToken } = await client.loginWithOAuth2({
        code,
        codeVerifier,
        redirectUri,
      });

      // Here you would typically save these tokens securely
      console.log('Access Token:', accessToken);
      console.log('Refresh Token:', refreshToken);

      return new Response(
        'Authorization successful! Check your console for tokens.',
        {
          headers: { 'content-type': 'text/html' },
        }
      );
    } catch (error) {
      console.error('Error during token exchange:', error);
      return new Response('Error during authorization', { status: 500 });
    }
  } else {
    return new Response('Not found', { status: 404 });
  }
}

console.log('Server running on http://localhost:8000');
await serve(handleRequest, { port: 8000 });

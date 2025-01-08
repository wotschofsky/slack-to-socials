# Social Cross-Poster

A Deno-based service that automatically cross-posts messages from Slack to multiple social media platforms (X/Twitter and Nostr) while maintaining user privacy through alias generation.

## Features

- Cross-posts messages from a specified Slack channel to:
- X (formerly Twitter)
- Nostr
- Automatically replaces Slack user mentions with randomly generated aliases
- Maintains consistent aliases across posts using Redis
- Provides posting status feedback in Slack message threads
- Handles rate limiting and duplicate post detection
- Auto-refreshes social media tokens when needed

## Prerequisites

- Deno 2.x or higher
- Redis server
- Slack workspace with admin access
- X (Twitter) developer account
- Nostr private key (nsec)

## Environment Variables

Create a `.env` file with the following variables:

```env
# Slack
SLACK_USER_TOKEN=xoxp-...
SLACK_CHANNEL_ID=C...

# Twitter/X
TWITTER_CLIENT_ID=...
TWITTER_CLIENT_SECRET=...

# Nostr
NOSTR_NSEC=...

# Redis
REDIS_URL=redis://localhost:6379
```

## Setup

1. Clone the repository:
```bash
git clone
cd social-cross-poster
```

2. Install dependencies:
```bash
deno cache main.ts
```

3. Set up Twitter authentication:
```bash
deno run --allow-net --allow-env --allow-read=.env tools/twitter-auth.ts
```
Follow the authorization flow and save the tokens in Redis.

4. Start the service:
```bash
deno task start
```

Or for development with auto-reload:
```bash
deno task dev
```

## Docker Support

Build and run using Docker:

```bash
docker build -t social-cross-poster .
docker run -d --env-file .env social-cross-poster
```

## Architecture

The service is built with a modular design, allowing easy addition of new social platforms:

- `SocialClient`: Abstract base class for social media platforms
- Platform-specific implementations:
 - `TwitterClient`: Handles X/Twitter posting with token refresh
 - `NostrClient`: Manages Nostr event creation and publishing

Redis is used for:
- Storing user aliases
- Tracking the last processed message timestamp
- Managing Twitter OAuth tokens

## Contributing

Contributions are welcome. Please open an issue or submit a pull request.

## License

MIT

import { createClient } from 'npm:redis@^4.5';

const client = createClient({
  url: Deno.env.get('REDIS_URL'),
});

await client.connect();

export default client;

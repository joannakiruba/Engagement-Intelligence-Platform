import Redis, { RedisOptions } from 'ioredis';

export function createRedisConnection(options: RedisOptions = {}): Redis {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    throw new Error('Missing required environment variable: REDIS_URL');
  }
  return new Redis(redisUrl, options);
}

const redis = createRedisConnection({
  maxRetriesPerRequest: 3,
  lazyConnect: true,
});

redis.on('error', (err) => {
  console.error('Redis connection error:', err.message);
});

export default redis;

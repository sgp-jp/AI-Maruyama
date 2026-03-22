import Redis from "ioredis";

const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";
const redis = new Redis(redisUrl);

console.log("worker started", { redisUrl });

setInterval(async () => {
  try {
    await redis.ping();
    console.log("worker heartbeat", new Date().toISOString());
  } catch (error) {
    console.error("worker error", error);
  }
}, 30000);

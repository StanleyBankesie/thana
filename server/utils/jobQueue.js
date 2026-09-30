/**
 * @file jobQueue.js
 * @description BullMQ-backed job queue utilities with graceful fallback when Redis is unavailable.
 */
import { Queue, Worker } from "bullmq";
import { getRawRedis } from "./redis.js";

const QUEUE_NAME = "low-stock-alerts";

/** @type {Queue|null} */
let lowStockQueue = null;

/** @type {Worker|null} */
let lowStockWorker = null;

/**
 * Initialise (or return existing) BullMQ queue + worker for low-stock alerts.
 * Returns null if Redis is unavailable, allowing the caller to fall back to setInterval.
 *
 * @param {() => Promise<void>} jobHandler - async function to run for each job
 * @returns {Queue|null}
 */
export function getLowStockQueue(jobHandler) {
  try {
    const redis = getRawRedis();
    if (!redis) return null;

    // Upstash Redis charges 1 request per blocking command (BLPOP/BZPOPMIN).
    // BullMQ relies heavily on these for polling, which rapidly consumes the 
    // Upstash request limits. We fall back to setInterval if Upstash is detected.
    if (redis.options && redis.options.host && redis.options.host.includes('upstash.io')) {
      console.warn("[JobQueue] Upstash Redis detected. BullMQ disabled to save request limits. Using setInterval fallback.");
      return null;
    }

    if (!lowStockQueue) {
      const connection = redis;

      lowStockQueue = new Queue(QUEUE_NAME, {
        connection,
        defaultJobOptions: {
          removeOnComplete: 50,
          removeOnFail: 20,
        },
      });

      lowStockWorker = new Worker(
        QUEUE_NAME,
        async () => {
          await jobHandler();
        },
        { connection }
      );

      lowStockWorker.on("failed", (job, err) => {
        console.error(`[JobQueue] Job ${job?.id} failed:`, err.message);
      });

      console.log("[JobQueue] BullMQ low-stock queue initialised");
    }

    return lowStockQueue;
  } catch (err) {
    console.warn("[JobQueue] BullMQ unavailable, will use setInterval fallback:", err.message);
    return null;
  }
}

/**
 * Gracefully close all job queues and workers.
 */
export async function closeJobQueues() {
  try {
    if (lowStockWorker) {
      await lowStockWorker.close();
      lowStockWorker = null;
    }
    if (lowStockQueue) {
      await lowStockQueue.close();
      lowStockQueue = null;
    }
    console.log("[JobQueue] All queues closed");
  } catch (err) {
    console.error("[JobQueue] Error closing queues:", err.message);
  }
}

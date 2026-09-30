# Debug Session: redis-request-limit

Status: OPEN

## Symptom
- Upstash Redis returns `ERR max requests limit exceeded`
- The failing command path is BullMQ queue activity for `bull:low-stock-alerts:*`
- Error appears during `evalsha` queue operations, suggesting repeated queue polling or job churn

## Initial Hypotheses
1. The `low-stock-alerts` BullMQ worker or scheduler is running too frequently and generating excessive Redis polling traffic.
2. Multiple server instances or duplicated worker initialization paths are creating the same `low-stock-alerts` queue/worker more than once.
3. A retry/error loop is continuously re-enqueueing low-stock jobs after Redis failures, amplifying request volume.
4. General Redis usage from session/auth/cache operations is already near the Upstash limit, and BullMQ traffic is only the visible tipping point.
5. Redis health/fallback handling is missing, so the app keeps attempting BullMQ operations even after Upstash starts rejecting requests.

## Evidence To Collect
- Where `low-stock-alerts` queue, worker, scheduler, and producers are initialized
- Whether initialization occurs once or multiple times per process
- Whether low-stock jobs are enqueued on an interval or on every request/startup
- Whether Redis wrapper logs show sustained failures or repeated reconnect/request attempts

## Planned Next Step
- Add instrumentation around Redis client setup and low-stock queue initialization/enqueue paths

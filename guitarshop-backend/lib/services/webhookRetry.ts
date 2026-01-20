type RetryJob = {
  id: string
  rawBody: string
  headers: Record<string, string>
  attempts: number
}

const queue: RetryJob[] = []
let processing = false

function sleep(ms: number) {
  return new Promise((res) => setTimeout(res, ms))
}

export function enqueueWebhookRetry(id: string, rawBody: string, headers: Record<string, string>) {
  queue.push({ id, rawBody, headers, attempts: 0 })
  processQueue()
}

async function processQueue() {
  if (processing) return
  processing = true
  try {
    while (queue.length > 0) {
      const job = queue.shift()!
      // Exponential backoff based on attempts
      const delay = Math.min(60000, Math.pow(2, job.attempts) * 1000)
      await sleep(delay)
      try {
        // dynamic import to avoid circular deps
        const svc = await import("./payphone.webhook")
        // call handler; if succeeds, continue
        // handler expects rawBody and headers
        await svc.handlePayphoneWebhook(job.rawBody, job.headers)
      } catch (err) {
        job.attempts += 1
        if (job.attempts < 5) {
          // requeue for another attempt
          queue.push(job)
        } else {
          // give up after 5 attempts; capture to observability
          try { const obs = await import("../observability/sentry"); obs.captureException(err) } catch {}
        }
      }
    }
  } finally {
    processing = false
  }
}

const webhookRetry = { enqueueWebhookRetry }

export default webhookRetry

let captureExceptionFn: (e: unknown) => void = () => {}
let captureMessageFn: (m: string, level?: string) => void = () => {}

export async function initObservability() {
  const dsn = process.env.SENTRY_DSN || process.env.PAYPHONE_SENTRY_DSN
  if (!dsn) return
  try {
    // dynamic import so project doesn't fail if @sentry/node is not installed
    // Optional: install @sentry/node in production to enable
    // Use a dynamic runtime import helper to prevent webpack/next from
    // statically analysing the `@sentry/node` package and its transitive
    // dependencies (which can trigger 'Critical dependency' warnings).
    const dynamicImport = new Function('moduleName', 'return import(moduleName)')
    const mod = await dynamicImport('@' + 'sentry/node')
    const Sentry = mod as unknown as {
      init: (opts: { dsn: string; environment?: string }) => void
      captureException?: (e: unknown) => void
      captureMessage?: (m: string, opts?: { level?: string }) => void
    }
    Sentry.init({ dsn, environment: process.env.NODE_ENV || "development" })
    captureExceptionFn = (e: unknown) => {
      try {
        if (Sentry.captureException) Sentry.captureException(e)
      } catch {}
    }
    captureMessageFn = (m: string, level = "info") => {
      try {
        if (Sentry.captureMessage) Sentry.captureMessage(m, { level })
      } catch {}
    }
    console.info("Sentry initialized")
  } catch (err) {
    console.warn("Sentry init failed or not installed", err)
  }
}

export function captureException(e: unknown) {
  try { captureExceptionFn(e) } catch {}
}

export function captureMessage(m: string, level?: string) {
  try { captureMessageFn(m, level) } catch {}
}

const observability = { initObservability, captureException, captureMessage }

export default observability

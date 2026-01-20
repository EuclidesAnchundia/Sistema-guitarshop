import { api } from "./apiClient"

export async function nextCode(kind: "producto" | "factura", opts?: { prefix?: string; date?: string }) {
  const body: Record<string, unknown> = { kind }
  if (opts?.prefix) body.prefix = opts.prefix
  if (opts?.date) body.date = opts.date

  const { data } = await api.post<{ code?: string; codes?: string[] }>("/codigos/next", body)
  return (data?.code ?? (Array.isArray(data?.codes) ? data.codes[0] : null)) ?? null
}

export async function nextCodes(kind: "producto" | "factura", count: number, prefixes?: (string | null)[]) {
  const body: Record<string, unknown> = { kind, count }
  if (prefixes) body.prefixes = prefixes
  const { data } = await api.post<{ codes?: string[] }>("/codigos/next", body)
  return data?.codes ?? null
}

export default { nextCode, nextCodes }

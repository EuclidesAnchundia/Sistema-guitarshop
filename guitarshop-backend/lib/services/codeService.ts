import { Prisma } from "../../generated/prisma/client";
import prisma from "../prisma";

type Tx = typeof prisma | Prisma.TransactionClient;

// Devuelve el siguiente número para la clave `prefix` de forma atómica.
export async function nextNumberForPrefix(tx: Tx, prefix: string): Promise<number> {
  // Usamos una consulta SQL atómica con ON CONFLICT para evitar race conditions.
  const q = tx as unknown as { $queryRaw: (...args: unknown[]) => Promise<unknown> };
  const rows = await q.$queryRaw`
    INSERT INTO codigo_sequence (prefix, last_number)
    VALUES (${prefix}, 1)
    ON CONFLICT (prefix) DO UPDATE SET last_number = codigo_sequence.last_number + 1
    RETURNING last_number;
  `;

  // Dependiendo del cliente, $queryRaw puede devolver array u objeto.
  const val = Array.isArray(rows) ? rows[0] : rows;
  return Number(val?.last_number ?? 1);
}

export function padNumber(n: number, width: number) {
  return String(n).padStart(width, "0");
}

// Genera código para factura con formato FAC-YYYYMMDD-NNNN
export async function generateFacturaNumber(tx: Tx, date: Date = new Date()): Promise<string> {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  const dateStr = `${y}${m}${d}`;
  const prefix = `FAC-${dateStr}`;
  const next = await nextNumberForPrefix(tx, prefix);
  return `${prefix}-${padNumber(next, 4)}`; // padding 4
}

// Genera código para producto con formato PRD-NNNNNN
export async function generateProductCode(tx: Tx, prefix = "PRD"): Promise<string> {
  const key = prefix.toUpperCase();
  const next = await nextNumberForPrefix(tx, key);
  return `${key}-${padNumber(next, 6)}`; // padding 6
}

// Genera un lote de códigos de producto de forma atómica.
export async function generateProductCodesBatch(
  tx: Tx,
  count: number,
  prefixes?: (string | null)[]
): Promise<string[]> {
  const results: string[] = []
  for (let i = 0; i < count; i++) {
    const rawPrefix = prefixes && prefixes[i] ? prefixes[i] : null
    const key = rawPrefix ? String(rawPrefix).toUpperCase() : "PRD"
    const next = await nextNumberForPrefix(tx, key)
    results.push(`${key}-${padNumber(next, 6)}`)
  }
  return results
}

const codeService = {
  nextNumberForPrefix,
  generateFacturaNumber,
  generateProductCode,
  generateProductCodesBatch,
}

export default codeService;

import { jsonCors, optionsCors } from "../../../../../../../lib/cors";
import { verifyToken, hasAdminRole } from "../../../../../../../lib/auth";
import { withErrorHandling } from "../../../../../../../src/shared/http/routeHandler";
import { registrarPagoCuota, type MetodoPagoCredito } from "../../../../../../../lib/services/cuotaService";

export async function OPTIONS() {
  return optionsCors();
}

function getParamsFromUrl(req: Request): { creditoId: number | null; cuotaId: number | null } {
  const url = new URL(req.url);
  const parts = url.pathname.split("/");
  const idxCreditos = parts.findIndex((p) => p === "creditos");
  const idxCuotas = parts.findIndex((p) => p === "cuotas");

  const creditoId = idxCreditos >= 0 ? Number(parts[idxCreditos + 1]) : NaN;
  const cuotaId = idxCuotas >= 0 ? Number(parts[idxCuotas + 1]) : NaN;

  return {
    creditoId: Number.isNaN(creditoId) ? null : creditoId,
    cuotaId: Number.isNaN(cuotaId) ? null : cuotaId,
  };
}

function normalizeMetodo(raw: unknown): MetodoPagoCredito {
  const m = typeof raw === "string" ? raw.toUpperCase() : "";
  if (m === "TRANSFERENCIA" || m === "TARJETA") return m as MetodoPagoCredito;
  return "EFECTIVO";
}

// POST /api/creditos/:creditoId/cuotas/:cuotaId/pagos
export const POST = withErrorHandling(async (req: Request) => {
  const auth = verifyToken(req);
  if (!auth.valid || !auth.userId) {
    return jsonCors({ error: auth.message ?? "Token inválido" }, { status: 401 });
  }

  // Permisos (hoy: admin). TODO: permitir CAJERO/COBRANZAS si aplica.
  if (!hasAdminRole(auth)) {
    return jsonCors({ error: "Acceso restringido" }, { status: 403 });
  }

  const { creditoId, cuotaId } = getParamsFromUrl(req);
  if (!creditoId || !cuotaId) {
    return jsonCors({ error: "Parámetros inválidos" }, { status: 400 });
  }

  const body = (await req.json().catch(() => null)) as
    | {
        monto?: number;
        fecha?: string;
        metodo?: string;
        referencia?: string;
        nota?: string;
        pagarTodoCredito?: boolean;
      }
    | null;

  const monto = Number(body?.monto);
  const fecha = body?.fecha ? new Date(body.fecha) : new Date();
  const metodo = normalizeMetodo(body?.metodo);
  const referencia = body?.referencia ?? null;
  const nota = body?.nota ?? null;
  const pagarTodoCredito = Boolean(body?.pagarTodoCredito);

  try {
    const result = await registrarPagoCuota({
      id_credito: creditoId,
      id_cuota: cuotaId,
      monto,
      fecha,
      metodo,
      referencia,
      nota,
      id_usuario: auth.userId,
      pagarTodoCredito,
    });

    return jsonCors(
      {
        message: "Pago registrado correctamente",
        credit: {
          id: result.credit.id_credito,
          saldoPendiente: result.credit.saldo_pendiente,
          status: result.credit.estado_credito,
          fechaFin: result.credit.fecha_fin,
        },
      },
      { status: 200 }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "ERROR";

    const map: Record<string, { status: number; error: string }> = {
      MONTO_INVALIDO: { status: 400, error: "Monto inválido" },
      REFERENCIA_REQUERIDA: { status: 400, error: "Referencia requerida para transferencia" },
      CREDITO_NO_ENCONTRADO: { status: 404, error: "Crédito no encontrado" },
      CUOTA_NO_ENCONTRADA: { status: 404, error: "Cuota no encontrada" },
      CUOTA_YA_PAGADA: { status: 409, error: "La cuota ya está pagada" },
      CREDITO_CANCELADO: { status: 409, error: "El crédito ya está cancelado" },
      MONTO_SUPERA_SALDO_CUOTA: { status: 400, error: "El monto supera el saldo pendiente de la cuota" },
      MONTO_SUPERA_SALDO_CREDITO: { status: 400, error: "El monto supera el saldo pendiente del crédito" },
      PAGO_INCONSISTENTE: { status: 400, error: "No se pudo distribuir el pago. Verifica el monto." },
      MOVIMIENTO_CREDITO_TABLE_MISSING: {
        status: 500,
        error: "Falta aplicar la migración de auditoría (tabla movimiento_credito). Ejecuta migraciones y reinicia el backend.",
      },
    };

    const mapped = map[msg];
    if (mapped) {
      return jsonCors({ error: mapped.error }, { status: mapped.status });
    }

    throw e;
  }
});

import { jsonCors, optionsCors } from "../../../../../lib/cors";
import { hasAdminRole, verifyToken } from "../../../../../lib/auth";
import { withErrorHandling } from "../../../../../src/shared/http/routeHandler";
import { validarAnulacionVenta } from "../../../../../lib/services/facturaService";

export async function OPTIONS() {
  return optionsCors();
}

function getIdFromUrl(req: Request): number | null {
  const url = new URL(req.url);
  const parts = url.pathname.split("/");
  const idString = parts[parts.length - 2];
  const id = Number(idString);
  return Number.isNaN(id) ? null : id;
}

// GET /api/ventas/:id/can-cancel
export const GET = withErrorHandling(async (req: Request) => {
  const auth = verifyToken(req);
  if (!auth.valid) {
    return jsonCors({ error: auth.message ?? "Token inválido" }, { status: 401 });
  }

  if (!hasAdminRole(auth)) {
    return jsonCors({ error: "Solo administradores pueden acceder a ventas" }, { status: 403 });
  }

  const id = getIdFromUrl(req);
  if (!id) {
    return jsonCors({ error: "ID inválido" }, { status: 400 });
  }

  const result = await validarAnulacionVenta(id);

  if (!result.canCancel) {
    const message =
      result.reason === "VENTA_YA_ANULADA"
        ? "La venta ya está anulada."
        : result.reason === "CREDITO_CON_PAGOS"
          ? "No se puede anular porque el crédito ya tiene pagos registrados."
          : result.reason === "VENTA_NO_ENCONTRADA"
            ? "Venta no encontrada."
            : result.reason === "ESTADO_ANULADO_NO_CONFIGURADO"
              ? "Configuración incompleta: estado ANULADO no existe."
              : "No se puede anular esta venta.";

    return jsonCors({ canCancel: false, reason: result.reason, message }, { status: 200 });
  }

  return jsonCors({ canCancel: true }, { status: 200 });
});

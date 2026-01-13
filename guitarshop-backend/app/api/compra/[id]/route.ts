// guitarshop-backend/app/api/compra/[id]/route.ts
import { jsonCors, optionsCors } from "../../../../lib/cors";
import { verifyToken } from "../../../../lib/auth";
import { obtenerCompraPorId } from "../../../../lib/services/compraService";

export async function OPTIONS() {
  return optionsCors();
}

function getIdFromUrl(req: Request): number | null {
  const url = new URL(req.url);
  const parts = url.pathname.split("/");
  const idString = parts[parts.length - 1];
  const id = Number(idString);
  return Number.isNaN(id) ? null : id;
}

// GET /api/compra/:id  (cabecera + detalle)
export async function GET(req: Request) {
  const auth = verifyToken(req);
  if (!auth.valid) {
    return jsonCors(
      { error: auth.message ?? "Token inválido" },
      { status: 401 }
    );
  }

  const id = getIdFromUrl(req);
  if (!id) {
    return jsonCors({ error: "ID inválido" }, { status: 400 });
  }

  try {
    const compra = await obtenerCompraPorId(id);
    if (!compra) {
      return jsonCors({ error: "Compra no encontrada" }, { status: 404 });
    }

    return jsonCors(compra, { status: 200 });
  } catch (error) {
    console.error("Error GET /compras/:id", error);
    return jsonCors(
      { error: "Error al obtener compra" },
      { status: 500 }
    );
  }
}

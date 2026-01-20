import { jsonCors, optionsCors } from "../../../../../lib/cors";
import prisma from "../../../../../lib/prisma";
import { withErrorHandling } from "../../../../../src/shared/http/routeHandler";

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

// GET /api/payments/by-factura/:id
export const GET = withErrorHandling(async (req: Request) => {
  const id = getIdFromUrl(req);
  if (!id) return jsonCors({ error: "ID inválido" }, { status: 400 });

  const payments = await prisma.payment.findMany({ where: { id_factura: id }, orderBy: { created_at: "desc" } });
  return jsonCors({ payments }, { status: 200 });
});

import prisma from "./prismaClient";

export async function ensureEstadoRegistroActivo() {
  return prisma.estado_registro.upsert({
    where: { nombre_estado: "ACTIVO" },
    update: { descripcion: "Registro activo" },
    create: { nombre_estado: "ACTIVO", descripcion: "Registro activo" },
    select: { id_estado: true },
  });
}

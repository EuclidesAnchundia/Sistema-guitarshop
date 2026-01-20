import "dotenv/config";
import prisma from "../lib/prisma";

async function main() {
  console.log("Ultimos 30 productos:");
  const productos = await prisma.producto.findMany({
    orderBy: { id_producto: "desc" },
    take: 30,
    select: { id_producto: true, codigo_producto: true, nombre_producto: true, fecha_creacion: true },
  });
  productos.forEach((p) => console.log(p.id_producto, p.codigo_producto, p.nombre_producto, p.fecha_creacion?.toISOString()));

  console.log('\nContadores (codigo_sequence):');
  const seqs = await prisma.codigo_sequence.findMany({ orderBy: { prefix: "asc" } });
  seqs.forEach((s) => console.log(s.prefix, s.last_number));

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

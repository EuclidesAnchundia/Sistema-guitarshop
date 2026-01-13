import fs from "node:fs";
import path from "node:path";

function copyIfPresent(fileName) {
	const src = path.join(process.cwd(), "generated", "prisma", fileName);
	const dest = path.join(process.cwd(), "generated", fileName);

	if (!fs.existsSync(src)) return;
	fs.mkdirSync(path.dirname(dest), { recursive: true });

	// Copia idempotente.
	try {
		fs.copyFileSync(src, dest);
	} catch (error) {
		// Si falla (p.ej. permisos), dejamos que el build reporte el problema.
		throw error;
	}
}

copyIfPresent("query_engine-windows.dll.node");
copyIfPresent("libquery_engine-debian-openssl-3.0.x.so.node");

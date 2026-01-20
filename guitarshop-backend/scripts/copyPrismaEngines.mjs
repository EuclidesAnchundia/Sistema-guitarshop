import fs from "node:fs";
import path from "node:path";

function copyIfPresent(fileName) {
	const src = path.join(process.cwd(), "generated", "prisma", fileName);
	const dest = path.join(process.cwd(), "generated", fileName);

	if (!fs.existsSync(src)) return;
	fs.mkdirSync(path.dirname(dest), { recursive: true });

	// Copia idempotente. Intentamos copiar, y en caso de EBUSY o bloqueo
	// no abortamos el build: logueamos y seguimos (el engine ya puede estar en uso).
	try {
		fs.copyFileSync(src, dest);
	} catch (error) {
		// Si el archivo está ocupado por otro proceso (EBUSY) o existe, no fallamos el build.
		if (error && (error.code === 'EBUSY' || error.code === 'EEXIST' || error.code === 'EPERM')) {
			console.warn(`Advertencia: no se pudo copiar ${fileName}:`, error.code);
			return;
		}
		// Otros errores los re-lanzamos para que el build los detecte.
		throw error;
	}
}

copyIfPresent("query_engine-windows.dll.node");
copyIfPresent("libquery_engine-debian-openssl-3.0.x.so.node");

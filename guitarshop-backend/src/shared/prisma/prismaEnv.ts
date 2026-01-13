import fs from "node:fs";
import path from "node:path";

// En builds/bundling (p.ej. Next + Turbopack) Prisma puede fallar al resolver el engine.
// Este fallback evita el error "could not locate the Query Engine" en Windows.
// Nota: durante `next build` el cwd puede ser la raíz del monorepo, no necesariamente `guitarshop-backend`.

if (process.platform === "win32" && !process.env.PRISMA_QUERY_ENGINE_BINARY) {
	const engineFile = "query_engine-windows.dll.node";
	const candidates = [
		path.join(process.cwd(), "generated", "prisma", engineFile),
		path.join(process.cwd(), "guitarshop-backend", "generated", "prisma", engineFile),
	];

	for (const candidate of candidates) {
		if (fs.existsSync(candidate)) {
			process.env.PRISMA_QUERY_ENGINE_BINARY = candidate;
			break;
		}
	}
}

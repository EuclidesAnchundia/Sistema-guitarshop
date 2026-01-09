import "dotenv/config";
import bcrypt from "bcryptjs";
import prisma from "../lib/prisma";

const ADMIN_EMAIL = "davidanchundia619@gmail.com";
const ADMIN_PASSWORD = "david";
const ADMIN_NAME = "David Anchundia";
const ADMIN_ROLE = "ADMIN";

async function ensureAdminUser() {
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, salt);

  const estadoActivo = await prisma.estado_registro.upsert({
    where: { nombre_estado: "ACTIVO" },
    update: {
      descripcion: "Registro activo",
    },
    create: {
      nombre_estado: "ACTIVO",
      descripcion: "Registro activo",
    },
    select: { id_estado: true },
  });

  const admin = await prisma.usuario.upsert({
    where: { correo: ADMIN_EMAIL },
    update: {
      nombre_completo: ADMIN_NAME,
      password_hash: passwordHash,
      rol: ADMIN_ROLE,
      id_estado: estadoActivo.id_estado,
    },
    create: {
      nombre_completo: ADMIN_NAME,
      correo: ADMIN_EMAIL,
      password_hash: passwordHash,
      rol: ADMIN_ROLE,
      id_estado: estadoActivo.id_estado,
    },
    select: {
      id_usuario: true,
      nombre_completo: true,
      correo: true,
      rol: true,
    },
  });

  return admin;
}

async function main() {
  try {
    const admin = await ensureAdminUser();
    console.log("Usuario admin listo:", admin);
  } catch (error) {
    console.error("No se pudo crear el usuario admin:", error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();

import prisma from "../../../shared/prisma/prismaClient";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { ensureEstadoRegistroActivo } from "../../../shared/prisma/estadoRegistro";

function getJwtSecret() {
  const secret = process.env.JWT_SECRET as string | undefined;
  if (!secret) {
    throw new Error("JWT_SECRET no está definido en las variables de entorno");
  }
  return secret;
}

// Para usar al crear / actualizar usuarios
export async function hashPassword(plainPassword: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(plainPassword, salt);
}

export async function loginUsuario(email: string, password: string) {
  const estadoActivo = await ensureEstadoRegistroActivo();

  // Busca usuario por correo
  const user = await prisma.usuario.findUnique({
    where: { correo: email },
  });

  // Si no existe
  if (!user) return { error: "Usuario no encontrado" };

  // Si está inactivo por estado
  if (user.id_estado !== estadoActivo.id_estado) return { error: "Usuario inactivo" };

  // Si está inactivo por campo activo
  if (!user.activo) return { error: "Usuario desactivado" };

  // Si está bloqueado
  if (user.bloqueado) return { error: "Usuario bloqueado, contacte al administrador" };

  // Compara contraseña enviada con el password_hash de la BD
  const passwordOk = await bcrypt.compare(password, user.password_hash);
  if (!passwordOk) return { error: "Credenciales inválidas" };

  // Payload del token (ojo: la propiedad se llama "id" porque
  // tu verifyToken la lee así)
  const token = jwt.sign(
    {
      id: user.id_usuario,
      correo: user.correo,
      rol: user.rol,
    },
    getJwtSecret(),
    { expiresIn: "2h" }
  );

  // Lo que devolvemos al frontend (sin password_hash)
  return {
    token,
    usuario: {
      id_usuario: user.id_usuario,
      nombre_completo: user.nombre_completo,
      correo: user.correo,
      rol: user.rol,
      activo: user.activo,
      bloqueado: user.bloqueado,
    },
  };
}

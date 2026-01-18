import 'dotenv/config'
import bcrypt from 'bcryptjs'
import prisma from '../src/shared/prisma/prismaClient'

/**
 * Variables de entorno (recomendado)
 * Si no existen, usa valores por defecto SOLO en desarrollo
 */
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'davidanchundia619@gmail.com'
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'david'
const ADMIN_NAME = process.env.ADMIN_NAME || 'David Anchundia'
const ADMIN_ROLE = 'ADMIN'

async function ensureEstadoActivo() {
  const estado = await prisma.estado_registro.upsert({
    where: { nombre_estado: 'ACTIVO' },
    update: {
      descripcion: 'Registro activo',
    },
    create: {
      nombre_estado: 'ACTIVO',
      descripcion: 'Registro activo',
    },
    select: { id_estado: true },
  })

  return estado.id_estado
}

async function ensureAdminUser(idEstadoActivo: number) {
  // Verificar si el admin ya existe
  const existingAdmin = await prisma.usuario.findUnique({
    where: { correo: ADMIN_EMAIL },
    select: { password_hash: true },
  })

  // Solo generar hash si el usuario NO existe
  const passwordHash =
    existingAdmin?.password_hash ??
    (await bcrypt.hash(ADMIN_PASSWORD, 10))

  const admin = await prisma.usuario.upsert({
    where: { correo: ADMIN_EMAIL },
    update: {
      nombre_completo: ADMIN_NAME,
      rol: ADMIN_ROLE,
      id_estado: idEstadoActivo,
      activo: true,
      bloqueado: false,
      intentos_fallidos: 0,
    },
    create: {
      nombre_completo: ADMIN_NAME,
      correo: ADMIN_EMAIL,
      password_hash: passwordHash,
      rol: ADMIN_ROLE,
      id_estado: idEstadoActivo,
      activo: true,
      bloqueado: false,
      intentos_fallidos: 0,
      fecha_nacimiento: new Date('2005-07-26'), 
    },
    select: {
      id_usuario: true,
      nombre_completo: true,
      correo: true,
      rol: true,
      activo: true,
      bloqueado: true,
    },
  })

  return admin
}

async function main() {
  console.log('Ejecutando seed (ADMIN ONLY)...')

  const idEstadoActivo = await ensureEstadoActivo()
  const admin = await ensureAdminUser(idEstadoActivo)

  console.log('Usuario admin listo:')
  console.table(admin)

  console.log('Seed finalizado correctamente')
}

main()
  .catch((error) => {
    console.error('Error ejecutando seed:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

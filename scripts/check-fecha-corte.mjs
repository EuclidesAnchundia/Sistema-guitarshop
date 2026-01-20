#!/usr/bin/env node
import process from 'process'

const BASE = process.env.BASE_URL || 'http://localhost:3000'
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'davidanchundia619@gmail.com'
const ADMIN_PASS = process.env.ADMIN_PASS || 'david'

function log(...args){ console.log('[check-fecha-corte]', ...args) }

async function login(){
  const res = await fetch(`${BASE}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASS })
  })
  if (!res.ok) throw new Error('login failed: '+res.status)
  const json = await res.json()
  return json.token || json.accessToken || json
}

async function createCliente(token, payload){
  const res = await fetch(`${BASE}/api/cliente`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload)
  })
  const txt = await res.text()
  try { return JSON.parse(txt) } catch { throw new Error('createCliente failed: '+res.status+' '+txt) }
}

async function createVenta(token, payload){
  const res = await fetch(`${BASE}/api/ventas`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload)
  })
  const txt = await res.text()
  try { return JSON.parse(txt) } catch { throw new Error('createVenta failed: '+res.status+' '+txt) }
}

async function run(){
  try {
    log('Base URL', BASE)
    const token = process.env.AUTH_TOKEN || await login()
    log('Token obtained')

    const clientePayload = {
      nombres: 'Carlos',
      apellidos: 'Perez',
      cedula: 'TEST'+Date.now().toString().slice(-6),
      fecha_nacimiento: '2006-01-15'
    }

    const cliente = await createCliente(token, clientePayload)
    log('Cliente creado:', cliente.id_cliente, 'fecha_nacimiento:', cliente.fecha_nacimiento)

    const ventaPayload = {
      id_cliente: cliente.id_cliente,
      id_usuario: cliente.id_usuario ?? 1,
      forma_pago: 'CREDITO',
      detalle: [ { id_producto: 1, cantidad: 1, precio_unitario: 1 } ],
      creditoConfig: { numero_cuotas: 3 }
    }

    const venta = await createVenta(token, ventaPayload)
    log('Venta creada:', venta?.id_factura ?? venta)

    const credito = venta?.credito?.[0]
    if (!credito) {
      log('No se generó crédito en la respuesta; muestra completa:', JSON.stringify(venta, null, 2))
      process.exit(1)
    }

    log('Credito generado: monto_total=', credito.monto_total)
    log('Cuotas:')
    for (const c of credito.cuota) {
      log('- #'+c.numero_cuota, 'vencimiento=', c.fecha_vencimiento)
    }

  } catch (err) {
    console.error(err)
    process.exit(2)
  }
}

run()

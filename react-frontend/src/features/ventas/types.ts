export type ClienteOption = {
  id_cliente: number
  nombres: string
  apellidos: string
  cedula: string
  fecha_nacimiento?: string | null
}

export type ProductoOption = {
  id_producto: number
  nombre_producto: string
  codigo_producto: string
  precio_venta: number
  cantidad_stock: number
  stock_minimo: number
}

import { formatMoney } from "../../../utils/number"
import type { VentaDetailRecord } from "../../../services/salesService"

type Props = {
  sale: VentaDetailRecord
}

export function SaleInvoicePreview({ sale }: Props) {
  const clienteNombre = sale.cliente
    ? `${sale.cliente.nombres} ${sale.cliente.apellidos}`.toUpperCase()
    : "CONSUMIDOR FINAL"
  const clienteCedula = sale.cliente?.cedula || "9999999999"
  const fecha = sale.fecha_factura
    ? new Date(sale.fecha_factura).toLocaleDateString("es-EC", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      })
    : ""
  const hora = sale.fecha_factura
    ? new Date(sale.fecha_factura).toLocaleTimeString("es-EC", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : ""

  const subtotal0 = 0
  const subtotal15 = sale.subtotal || 0
  const iva15 = sale.impuesto || 0
  const total = sale.total || 0

  return (
    <div className="mx-auto w-full bg-white p-6 text-black font-sans" style={{ maxWidth: '210mm' }}>
      <div className="border-b-2 border-black pb-3 text-center">
        <h1 className="text-xl font-bold uppercase tracking-wide">GUITARSHOP</h1>
        <p className="text-sm mt-1">RUC: 1234567890001</p>
        <p className="text-sm">Av. Principal #123 y Secundaria</p>
        <p className="text-sm">Telf: 02-2345678 / 0998765432</p>
        <p className="text-sm">Quito - Ecuador</p>
      </div>

      <div className="mt-5 text-center">
        <h2 className="text-lg font-bold uppercase tracking-wider">NOTA DE ENTREGA</h2>
      </div>

      <div className="mt-5 border-2 border-black p-3">
        <div className="flex justify-between text-sm mb-1">
          <span className="font-medium">Ticket No:</span>
          <span className="font-bold tabular-nums">{sale.numero_factura || "001-000000"}</span>
        </div>
        <div className="flex justify-between text-sm mb-1">
          <span className="font-medium">Fecha:</span>
          <span className="tabular-nums">{fecha}</span>
        </div>
        <div className="flex justify-between text-sm mb-1">
          <span className="font-medium">Hora:</span>
          <span className="tabular-nums">{hora}</span>
        </div>
        <div className="flex justify-between text-sm mb-1">
          <span className="font-medium">Atendido por:</span>
          <span>{sale.usuario?.nombre_completo || "SISTEMA"}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="font-medium">Forma de Pago:</span>
          <span className="font-bold">{sale.forma_pago || "EFECTIVO"}</span>
        </div>
      </div>

      <div className="mt-4 border-2 border-black p-3">
        <div className="flex text-sm mb-1">
          <span className="font-bold min-w-[100px]">Nombre:</span>
          <span className="flex-1">{clienteNombre}</span>
        </div>
        <div className="flex text-sm mb-1">
          <span className="font-bold min-w-[100px]">Dirección:</span>
          <span className="flex-1">—</span>
        </div>
        <div className="flex text-sm">
          <span className="font-bold min-w-[100px]">Cédula/RUC:</span>
          <span className="flex-1 tabular-nums">{clienteCedula}</span>
        </div>
      </div>

      <div className="mt-5">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b-2 border-black">
              <th className="py-2 px-2 text-left font-bold uppercase text-xs">Cant.</th>
              <th className="py-2 px-2 text-left font-bold uppercase text-xs">Unid.</th>
              <th className="py-2 px-2 text-left font-bold uppercase text-xs">Descripción de Artículo</th>
              <th className="py-2 px-2 text-right font-bold uppercase text-xs">Val. Unit.</th>
              <th className="py-2 px-2 text-right font-bold uppercase text-xs">Valor T.</th>
            </tr>
          </thead>
          <tbody>
            {sale.detalle_factura.map((line, index) => (
              <tr key={line.id_detalle_factura || index} className="border-b border-slate-300">
                <td className="py-2 px-2 align-top tabular-nums">{line.cantidad}</td>
                <td className="py-2 px-2 align-top">UND</td>
                <td className="py-2 px-2 align-top">
                  <div>
                    <div className="font-medium">{line.producto?.nombre_producto || "—"}</div>
                    <div className="text-xs text-black mt-0.5">
                      Cód: {line.producto?.codigo_producto || "—"}
                    </div>
                  </div>
                </td>
                <td className="py-2 px-2 text-right align-top tabular-nums">
                  {formatMoney(line.precio_unitario)}
                </td>
                <td className="py-2 px-2 text-right align-top tabular-nums font-semibold">
                  {formatMoney(line.subtotal)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-5 ml-auto w-72 border-2 border-black p-3">
        <div className="flex justify-between text-sm mb-1">
          <span className="font-medium">SUBTOTAL:</span>
          <span className="tabular-nums">{formatMoney(subtotal15)}</span>
        </div>
        <div className="flex justify-between text-sm mb-1">
          <span className="font-medium">IVA 0%:</span>
          <span className="tabular-nums">{formatMoney(subtotal0)}</span>
        </div>
        <div className="flex justify-between text-sm mb-2">
          <span className="font-medium">IVA 15%:</span>
          <span className="tabular-nums">{formatMoney(iva15)}</span>
        </div>
        <div className="flex justify-between text-base border-t-2 border-black pt-2 font-bold">
          <span>TOTAL:</span>
          <span className="tabular-nums">{formatMoney(total)}</span>
        </div>
      </div>

      <div className="mt-8 space-y-6">
        <div className="flex justify-between gap-8">
          <div className="flex-1 text-center">
            <div className="border-t-2 border-black pt-2 mt-12 font-medium text-sm">
              Firma Responsable
            </div>
          </div>
          <div className="flex-1 text-center">
            <div className="border-t-2 border-black pt-2 mt-12 font-medium text-sm">
              Firma Cliente
            </div>
          </div>
        </div>
        <div className="border-2 border-black p-3 text-center font-bold text-sm">
          SALIDA LA MERCADERÍA NO SE ACEPTAN DEVOLUCIONES
        </div>
      </div>
    </div>
  )
}

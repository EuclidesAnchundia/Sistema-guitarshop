"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useFieldArray, useForm, useWatch } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../../../components/ui/dialog"
import { salesService, type VentaPayload } from "../../../services/salesService"
import { calcTotals } from "../../../modules/ventas/utils/salesCalc"
import { round2, toNumberSafe } from "../../../utils/number"

import type { ClienteOption, ProductoOption } from "../types"
import { type SaleCreateFormValues } from "./SaleItemsTable"
import { SaleSummaryPanel } from "./SaleSummaryPanel"
import { SaleTopBar } from "./SaleTopBar"
import { SaleSearchAutocomplete } from "./SaleSearchAutocomplete"
import { SaleCartTable } from "./SaleCartTable"
import { SaleInvoiceAutoPrint } from "./SaleInvoiceAutoPrint"

const IVA_RATE = 0.15

const detalleSchema = z
  .object({
    id_producto: z.number().int("Selecciona un producto válido").positive("Selecciona un producto"),
    cantidad: z.string(),
    precio_unitario: z.string(),
    descuento: z.string().optional().default("0"),
  })
  .superRefine((data, ctx) => {
    const cantidad = toNumberSafe(data.cantidad)
    const precio = toNumberSafe(data.precio_unitario)
    const descuento = toNumberSafe(data.descuento)

    if (!Number.isFinite(cantidad) || cantidad <= 0 || !Number.isInteger(cantidad)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["cantidad"], message: "Cantidad mínima 1" })
    }
    if (!Number.isFinite(precio) || precio < 0.01) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["precio_unitario"], message: "Precio mínimo 0.01" })
    }
    if (!Number.isFinite(descuento) || descuento < 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["descuento"], message: "Descuento inválido" })
    }

    const maxDiscount = Math.max(0, cantidad * precio)
    if (descuento > maxDiscount) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["descuento"], message: "Descuento supera el total de la línea" })
    }
  })

const ventaSchema = z.object({
  // 0 => consumidor final
  id_cliente: z.number().int("Cliente inválido").nonnegative("Cliente inválido"),
  observacion: z.string().trim().max(255, "Máximo 255 caracteres").optional().or(z.literal("")),
  forma_pago: z.enum(["CONTADO", "CREDITO"]),
  detalle: z.array(detalleSchema).min(1, "Agrega al menos un ítem"),
}).superRefine((data, ctx) => {
  // Regla de negocio: crédito requiere cliente
  if (data.forma_pago === "CREDITO" && (!data.id_cliente || data.id_cliente === 0)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["id_cliente"], message: "Selecciona un cliente para crédito" })
  }
})

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  clientes: ClienteOption[]
  productos: ProductoOption[]
  clientesLoading?: boolean
  productosLoading?: boolean
  isAdmin: boolean
}

const defaultValues: SaleCreateFormValues = {
  id_cliente: 0,
  observacion: "",
  forma_pago: "CONTADO",
  detalle: [],
}

export function SaleCreateModal({ open, onOpenChange, clientes, productos, clientesLoading }: Props) {
  const queryClient = useQueryClient()
  const autoPrintTimeoutRef = useRef<number | null>(null)

  const [formError, setFormError] = useState<string | null>(null)
  const [createdSale, setCreatedSale] = useState<import("../../../services/salesService").VentaDetailRecord | null>(null)
  const [autoPrintEnabled, setAutoPrintEnabled] = useState(false)
  const [successOpen, setSuccessOpen] = useState(false)
  const [descuentoGeneral, setDescuentoGeneral] = useState<number>(0)
  const [showConfirmClose, setShowConfirmClose] = useState(false)

  const form = useForm<SaleCreateFormValues>({
    resolver: zodResolver(ventaSchema),
    defaultValues,
  })

  const detalleFieldArray = useFieldArray({ control: form.control, name: "detalle" })
  const detalleValues = useWatch({ control: form.control, name: "detalle" })

  const productosMap = useMemo(() => {
    const map = new Map<number, ProductoOption>()
    productos.forEach((p) => map.set(p.id_producto, p))
    return map
  }, [productos])

  const totals = useMemo(() => {
    const items = Array.isArray(detalleValues) ? detalleValues : []
    const baseTotals = calcTotals(
      items.map((item) => ({ price: item?.precio_unitario, qty: item?.cantidad, discount: item?.descuento })),
      IVA_RATE
    )
    
    // Aplicar descuento general al subtotal
    const subtotalConDescuento = Math.max(0, baseTotals.subtotal - descuentoGeneral)
    const nuevoImpuesto = round2(subtotalConDescuento * IVA_RATE)
    const nuevoTotal = round2(subtotalConDescuento + nuevoImpuesto)
    
    return {
      subtotal: baseTotals.subtotal,
      descuento: descuentoGeneral,
      impuesto: nuevoImpuesto,
      total: nuevoTotal,
    }
  }, [detalleValues, descuentoGeneral])

  const buildPayload = (values: SaleCreateFormValues): VentaPayload => {
    return {
      id_cliente: values.id_cliente && values.id_cliente !== 0 ? values.id_cliente : null,
      forma_pago: values.forma_pago,
      observacion: values.observacion?.trim() ? values.observacion.trim() : null,
      detalle: values.detalle.map((item) => ({
        id_producto: item.id_producto,
        cantidad: Math.trunc(toNumberSafe(item.cantidad)),
        precio_unitario: round2(toNumberSafe(item.precio_unitario)),
        descuento: round2(toNumberSafe(item.descuento ?? "0")),
      })),
    }
  }

  useEffect(() => {
    return () => {
      if (autoPrintTimeoutRef.current) {
        window.clearTimeout(autoPrintTimeoutRef.current)
        autoPrintTimeoutRef.current = null
      }
    }
  }, [])

  const createMutation = useMutation({
    mutationFn: (payload: VentaPayload) => salesService.createSale(payload),
    onSuccess: (sale) => {
      queryClient.invalidateQueries({ queryKey: ["ventas"] })
      toast.success("Venta exitosa")

      // Imprimir automáticamente al crear la venta (sin modal/preview interno)
      setCreatedSale(sale)
      setSuccessOpen(true)
      setAutoPrintEnabled(false)

      // Dar ~1s para que el usuario vea el mensaje antes de abrir impresión
      if (autoPrintTimeoutRef.current) {
        window.clearTimeout(autoPrintTimeoutRef.current)
      }
      autoPrintTimeoutRef.current = window.setTimeout(() => {
        setAutoPrintEnabled(true)
      }, 1000)

      form.reset(defaultValues)
      setFormError(null)
      onOpenChange(false)
    },
    onError: (error: unknown) => {
      const msg = error instanceof Error && error.message.trim() ? error.message : "No se pudo registrar la venta"
      setFormError(msg)
      toast.error("Error al guardar")
    },
  })

  const confirmCloseIfDirty = (shouldClose: boolean = true) => {
    if (!form.formState.isDirty) {
      if (shouldClose) closeModal()
      return true
    }
    if (shouldClose) {
      setShowConfirmClose(true)
    }
    return !form.formState.isDirty
  }

  const closeModal = () => {
    setFormError(null)
    form.reset(defaultValues)
    onOpenChange(false)
  }

  const handleHeaderClose = () => {
    confirmCloseIfDirty(true)
  }

  const onSubmit = form.handleSubmit((values) => {
    setFormError(null)

    // Validación de stock en frontend para evitar error backend.
    let stockOk = true
    values.detalle.forEach((line, index) => {
      const product = productosMap.get(line.id_producto)
      if (!product) return
      const qty = Math.trunc(toNumberSafe(line.cantidad))
      if (qty > product.cantidad_stock) {
        stockOk = false
        form.setError(`detalle.${index}.cantidad` as const, {
          type: "validate",
          message: `Stock insuficiente (disp: ${product.cantidad_stock})`,
        })
      }
    })

    if (!stockOk) {
      toast.error("Revisa el stock disponible")
      return
    }

    createMutation.mutate(buildPayload(values))
  })

  const addProduct = (productId: number) => {
    const existingIndex = form.getValues("detalle").findIndex((l) => l.id_producto === productId)
    if (existingIndex >= 0) {
      const line = form.getValues(`detalle.${existingIndex}`)
      const currentQty = Math.trunc(toNumberSafe(line?.cantidad))
      const nextQty = Math.max(1, currentQty + 1)
      const product = productosMap.get(productId)
      const clampedQty = product ? Math.min(nextQty, product.cantidad_stock) : nextQty
      detalleFieldArray.update(existingIndex, { ...line, cantidad: String(clampedQty) })
      if (product && nextQty > product.cantidad_stock) {
        form.setError(`detalle.${existingIndex}.cantidad` as const, {
          type: "validate",
          message: `Stock insuficiente (disp: ${product.cantidad_stock})`,
        })
      }
    } else {
      const product = productosMap.get(productId)
      const precio = product ? product.precio_venta : 0
      const next = {
        id_producto: productId,
        cantidad: "1",
        precio_unitario: String(round2(precio)),
        descuento: "0",
      }
      form.setValue("detalle", [...form.getValues("detalle"), next], { shouldDirty: true, shouldTouch: true })
    }
  }

  const updateQty = (index: number, delta: number) => {
    const line = form.getValues(`detalle.${index}`)
    const product = productosMap.get(line.id_producto)
    const currentQty = Math.trunc(toNumberSafe(line.cantidad))
    const nextQtyRaw = currentQty + delta
    const nextQty = Math.max(1, nextQtyRaw)
    const clamped = product ? Math.min(nextQty, product.cantidad_stock) : nextQty
    detalleFieldArray.update(index, { ...line, cantidad: String(clamped) })

    if (product && nextQty > product.cantidad_stock) {
      form.setError(`detalle.${index}.cantidad` as const, {
        type: "validate",
        message: `Stock insuficiente (disp: ${product.cantidad_stock})`,
      })
    } else {
      form.clearErrors(`detalle.${index}.cantidad` as const)
    }
  }

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          // Bloqueado por diseño: no cerrar por overlay/ESC.
          if (!next) return
          onOpenChange(true)
        }}
      >
        <DialogContent className="dialog-content w-full max-w-6xl overflow-hidden p-0 sm:rounded-3xl" disableOutsideClose hideCloseButton>
          <div className="flex h-[95vh] flex-col">
            <DialogHeader className="border-b px-8 py-6 text-left flex-shrink-0">
              <DialogTitle className="text-2xl font-semibold text-slate-900">Registrar venta</DialogTitle>
              <DialogDescription>Completa los datos y guarda.</DialogDescription>
            </DialogHeader>

            {formError && (
              <div className="mx-8 mt-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 flex-shrink-0">
                {formError}
              </div>
            )}

            <form onSubmit={onSubmit} className="flex flex-1 flex-col overflow-hidden">
              <div className="flex-1 overflow-hidden flex flex-col">
                {/* Barra superior: cliente + observaciones */}
                <SaleTopBar form={form} clientes={clientes} clientesLoading={clientesLoading} />

                <div className="flex flex-1 overflow-hidden">
                  {/* Panel izquierdo 70% */}
                  <div className="flex w-[70%] flex-col border-r border-slate-200 bg-white overflow-hidden">
                    {/* Buscador */}
                    <div className="border-b border-slate-200 px-8 py-6 flex-shrink-0">
                      <SaleSearchAutocomplete
                        productos={productos}
                        onAddProduct={addProduct}
                    disabled={createMutation.isPending}
                  />
                    </div>

                    {/* Tabla del carrito */}
                    <div className="flex-1 overflow-y-auto px-8 py-6">
                      <SaleCartTable
                    items={detalleValues}
                    productosMap={productosMap}
                    onIncrement={(idx) => updateQty(idx, 1)}
                    onDecrement={(idx) => updateQty(idx, -1)}
                    onRemove={(idx) => detalleFieldArray.remove(idx)}
                      />
                    </div>
                  </div>

                  {/* Panel derecho 30% */}
                  <div className="w-[30%]">
                    <SaleSummaryPanel
                  subtotal={totals.subtotal}
                  descuento={totals.descuento}
                  iva={totals.impuesto}
                  total={totals.total}
                  hasItems={detalleValues.length > 0}
                  isSubmitting={createMutation.isPending}
                  onCancel={handleHeaderClose}
                  onDescuentoChange={(value) => {
                    const num = parseFloat(value) || 0
                    setDescuentoGeneral(Math.max(0, num))
                  }}
                    />
                  </div>
                </div>
              </div>
            </form>
          </div>
        </DialogContent>
      </Dialog>

      {/* Diálogo de confirmación para cerrar */}
      <Dialog open={showConfirmClose} onOpenChange={setShowConfirmClose}>
        <DialogContent className="dialog-content w-full max-w-lg sm:rounded-2xl p-0" disableOutsideClose>
          <DialogHeader className="px-8 py-6">
            <DialogTitle className="text-xl font-semibold text-slate-900">¿Descartar cambios?</DialogTitle>
            <DialogDescription className="text-sm text-slate-600 mt-3">
              Tienes cambios sin guardar. Si cierras perderás toda la información de la venta registrada.
            </DialogDescription>
          </DialogHeader>

          <div className="flex gap-3 justify-end px-8 py-6 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setShowConfirmClose(false)}
              className="rounded-xl border border-slate-300 px-6 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
            >
              Continuar editando
            </button>
            <button
              type="button"
              onClick={() => {
                setShowConfirmClose(false)
                closeModal()
              }}
              className="rounded-xl bg-red-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-red-700 transition"
            >
              Descartar cambios
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Aviso post-venta */}
      <Dialog
        open={successOpen}
        onOpenChange={(next) => {
          // Se cierra automáticamente al terminar impresión.
          if (!next) return
          setSuccessOpen(true)
        }}
      >
        <DialogContent className="dialog-content w-full max-w-md p-0 sm:rounded-2xl" disableOutsideClose hideCloseButton>
          <div className="px-8 py-7">
            <DialogHeader className="text-center">
              <DialogTitle className="text-xl font-semibold text-slate-900">Venta exitosa</DialogTitle>
              <DialogDescription className="mt-2 text-sm text-slate-600">
                Preparando impresión…
              </DialogDescription>
            </DialogHeader>

            <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-center">
              <p className="text-sm font-medium text-slate-700">Se abrirá el diálogo de impresión en un momento.</p>
              <p className="mt-1 text-xs text-slate-500">Si tu navegador bloquea ventanas, permite la impresión.</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Impresión automática post-venta (sin UI) */}
      <SaleInvoiceAutoPrint
        enabled={autoPrintEnabled}
        sale={createdSale}
        onDone={() => {
          setAutoPrintEnabled(false)
          setCreatedSale(null)
          setSuccessOpen(false)
        }}
      />
    </>
  )
}

"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../../../components/ui/dialog"
import { Printer, X } from "lucide-react"
import { useState, useEffect } from "react"
import { InvoicePrint } from "./InvoicePrint"
import { SaleInvoicePreview } from "./SaleInvoicePreview"
import { PrintRootPortal } from "./PrintRootPortal"
import { salesService, type VentaDetailRecord } from "../../../services/salesService"

type Props = {
  saleId: number | null
  open: boolean
  onClose: () => void
}

export function SaleInvoiceDialog({ saleId, open, onClose }: Props) {
  const [sale, setSale] = useState<VentaDetailRecord | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !saleId) {
      setSale(null)
      setError(null)
      return
    }

    // Cargar la venta completa desde el backend
    const loadSale = async () => {
      setIsLoading(true)
      setError(null)
      try {
        console.log("Loading sale with ID:", saleId)
        const data = await salesService.getSale(saleId)
        console.log("Sale loaded:", data)
        setSale(data)
      } catch (error) {
        console.error("Error loading sale:", error)
        setError("No se pudo cargar la factura")
      } finally {
        setIsLoading(false)
      }
    }

    loadSale()
  }, [open, saleId])

  const handlePrint = () => {
    const count = document.querySelectorAll("#invoice-print .printable-invoice").length
    console.log("printable count", count)
    if (count !== 1) {
      console.error("Error: printable-invoice duplicado", count)
      return
    }
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.print()
      })
    })
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="dialog-content max-w-4xl max-h-[90vh] overflow-y-auto" hideCloseButton>
        <DialogHeader className="no-print">
          <div className="flex items-center justify-between">
            <DialogTitle>Factura de venta</DialogTitle>
            <DialogDescription className="sr-only">Vista de factura para impresión</DialogDescription>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-900 hover:bg-slate-100"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </DialogHeader>

        <div className="mt-4">
          {isLoading && (
            <div className="flex justify-center py-12">
              <p className="text-slate-500">Cargando factura...</p>
            </div>
          )}

          {error && !isLoading && (
            <div className="flex justify-center py-12">
              <p className="text-red-500">{error}</p>
            </div>
          )}

          {!isLoading && !error && sale && (
            <>
              {/* Renderizar en print-root para impresión */}
              <PrintRootPortal>
                <InvoicePrint sale={sale} />
              </PrintRootPortal>

              {/* Vista en pantalla (sin clase printable) */}
              <div className="mb-6 overflow-x-auto">
                <SaleInvoicePreview sale={sale} />
              </div>

              <div className="flex gap-3 justify-end border-t pt-4 no-print">
                <button
                  type="button"
                  onClick={handlePrint}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  <Printer className="h-4 w-4" />
                  Imprimir
                </button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

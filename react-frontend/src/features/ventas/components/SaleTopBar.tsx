"use client"

import type { UseFormReturn } from "react-hook-form"
import type { SaleCreateFormValues } from "./SaleItemsTable"
import type { ClienteOption } from "../types"
import { SaleClientAutocomplete } from "./SaleClientAutocomplete"
import { getFechaCorte } from "../../clientes/cliente.utils"

type Props = {
  form: UseFormReturn<SaleCreateFormValues>
  clientes: ClienteOption[]
  clientesLoading?: boolean
  disabled?: boolean
}

export function SaleTopBar({ form, clientes, clientesLoading, disabled = false }: Props) {
  const formaPago = form.watch("forma_pago")

  return (
    <div className="border-b border-slate-200 bg-white px-8 py-6">
      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <SaleClientAutocomplete
            clientes={clientes}
            disabled={clientesLoading || disabled}
            onSelectCliente={(cliente) => {
              if (cliente) {
                form.setValue("id_cliente", cliente.id_cliente, {
                  shouldValidate: true,
                  shouldDirty: true,
                })

                // Si el cliente tiene fecha de nacimiento, sugerir fecha_primer_vencimiento
                if (cliente.fecha_nacimiento) {
                  try {
                    const fechaCorte = getFechaCorte(cliente.fecha_nacimiento)
                    // Formato YYYY-MM-DD requerido por input[type=date]
                    const y = fechaCorte.getFullYear()
                    const m = String(fechaCorte.getMonth() + 1).padStart(2, "0")
                    const d = String(fechaCorte.getDate()).padStart(2, "0")
                    form.setValue("creditoConfig.fecha_primer_vencimiento", `${y}-${m}-${d}`, { shouldDirty: true, shouldValidate: true })
                  } catch {
                    // ignore
                  }
                }
              }
            }}
            onSelectConsumidorFinal={() => {
              form.setValue("id_cliente", 0, {
                shouldValidate: false,
                shouldDirty: true,
              })
            }}
          />
        </div>

        <div>
          <label className="text-xs font-medium uppercase text-slate-500">Forma de pago</label>
          <select
            {...form.register("forma_pago")}
            disabled={disabled}
            className="mt-1 h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:bg-slate-50"
          >
            <option value="CONTADO">Contado</option>
            <option value="CREDITO">Crédito</option>
          </select>
        </div>

        <div>
          <label className="text-xs font-medium uppercase text-slate-500">Observaciones</label>
            <input
            type="text"
            {...form.register("observacion")}
            placeholder="Detalles adicionales (opcional)"
            disabled={disabled}
            className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:bg-slate-50"
          />
        </div>
      </div>

      {formaPago === "CREDITO" && (
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <div>
            <label className="text-xs font-medium uppercase text-slate-500">Número de cuotas</label>
            <input
              type="number"
              min={1}
              step={1}
              inputMode="numeric"
            {...form.register("creditoConfig.numero_cuotas")}
            disabled={disabled}
              className="mt-1 h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="text-xs font-medium uppercase text-slate-500">Primer vencimiento</label>
            <input
              type="date"
              {...form.register("creditoConfig.fecha_primer_vencimiento")}
              disabled={disabled}
              className="mt-1 h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:bg-slate-50"
            />
          </div>

          <div>
            <label className="text-xs font-medium uppercase text-slate-500">Días entre cuotas</label>
            <input
              type="number"
              min={1}
              step={1}
              inputMode="numeric"
              {...form.register("creditoConfig.dias_entre_cuotas")}
              className="mt-1 h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>
        </div>
      )}
    </div>
  )
}

"use client"

import type { UseFormReturn } from "react-hook-form"
import type { SaleCreateFormValues } from "./SaleItemsTable"
import type { ClienteOption } from "../types"
import { SaleClientAutocomplete } from "./SaleClientAutocomplete"

type Props = {
  form: UseFormReturn<SaleCreateFormValues>
  clientes: ClienteOption[]
  clientesLoading?: boolean
}

export function SaleTopBar({ form, clientes, clientesLoading }: Props) {
  const formaPago = form.watch("forma_pago")

  return (
    <div className="border-b border-slate-200 bg-white px-8 py-6">
      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <SaleClientAutocomplete
            clientes={clientes}
            disabled={clientesLoading}
            onSelectCliente={(cliente) => {
              if (cliente) {
                form.setValue("id_cliente", cliente.id_cliente, {
                  shouldValidate: true,
                  shouldDirty: true,
                })
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
            className="mt-1 h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
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
            className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
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
              className="mt-1 h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="text-xs font-medium uppercase text-slate-500">Primer vencimiento</label>
            <input
              type="date"
              {...form.register("creditoConfig.fecha_primer_vencimiento")}
              className="mt-1 h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
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

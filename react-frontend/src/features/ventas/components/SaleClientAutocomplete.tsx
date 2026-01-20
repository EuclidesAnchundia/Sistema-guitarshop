"use client"

import { useMemo, useState } from "react"
import type { ClienteOption } from "../types"
import GenericAutocomplete from "../../../components/GenericAutocomplete"

type Props = {
  clientes: ClienteOption[]
  onSelectCliente: (cliente: ClienteOption | null) => void
  onSelectConsumidorFinal: () => void
  disabled?: boolean
}

export function SaleClientAutocomplete({
  clientes,
  onSelectCliente,
  onSelectConsumidorFinal,
  disabled,
}: Props) {
  const [selectedId, setSelectedId] = useState<number | string | null>(null)

  // Build items array with a synthetic Consumidor Final entry first
  type Special = { __consumidor_final: true }
  const specialItem = useMemo<Special>(() => ({ __consumidor_final: true }), [])
  const items = useMemo<(ClienteOption | Special)[]>(() => [specialItem, ...clientes], [clientes, specialItem])

  return (
    <div className="relative">
      <label className="text-xs font-medium uppercase text-slate-500">Cliente</label>
      <GenericAutocomplete
        items={items}
        getId={(it) => (('__consumidor_final' in it ? (it as Special).__consumidor_final : false) ? -1 : (it as ClienteOption).id_cliente)}
        valueId={selectedId}
        getLabel={(it) => ('__consumidor_final' in it ? 'Consumidor Final' : `${(it as ClienteOption).nombres} ${(it as ClienteOption).apellidos}`)}
        getSubLabel={(it) => ('__consumidor_final' in it ? 'Sin datos específicos' : `Cédula: ${(it as ClienteOption).cedula}`)}
        placeholder="Nombre, apellido o cédula..."
        emptyText="Sin resultados."
        onSelect={(it) => {
          if (!it) return
          if ('__consumidor_final' in it && (it as Special).__consumidor_final) {
            onSelectConsumidorFinal()
            setSelectedId(-1)
            return
          }
          const client = it as ClienteOption
          onSelectCliente(client)
          setSelectedId(client.id_cliente)
        }}
        loading={!!disabled}
      />
    </div>
  )
}

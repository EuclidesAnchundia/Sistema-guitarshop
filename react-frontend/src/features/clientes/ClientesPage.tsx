"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { isAxiosError } from "axios"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { AlertCircle, Eye, Loader2, MoreHorizontal, Plus, Trash2, Users } from "lucide-react"
import { toast } from "sonner"

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../../components/ui/dialog"
import { useDebouncedValue } from "../../lib/hooks/useDebouncedValue"

import type { ClientePayload, ClienteRecord, ClientesFilters } from "./cliente.types"
import { clienteClient } from "./cliente.client"
import { getClienteFullName, matchesClienteSearch } from "./cliente.utils"
import { clientesQueryKey, useClientesQuery } from "./useClientesQuery"

import { ClientesDetailDrawer } from "./components/ClientesDetailDrawer"
import { ClientesFiltersDrawer } from "./components/ClientesFiltersDrawer"
import { ClientesListHeader, type ClientesFilterChip } from "./components/ClientesListHeader"

type ApiErrorResponse = {
error?: string
message?: string
}

const PAGE_SIZE_STORAGE_KEY = "clientes.pageSize"
const PAGE_SIZE_OPTIONS = [10, 20, 30, 40] as const

type PageSizeOption = (typeof PAGE_SIZE_OPTIONS)[number]

const DEFAULT_PAGE_SIZE: PageSizeOption = 20

const clienteSchema = z.object({
nombres: z.string().trim().min(3, "Mínimo 3 caracteres").max(60, "Máximo 60 caracteres"),
apellidos: z.string().trim().min(3, "Mínimo 3 caracteres").max(60, "Máximo 60 caracteres"),
cedula: z
.string()
.trim()
.regex(/^\d{10}$/, "Debe tener 10 dígitos"),
correo: z
.string()
.trim()
.max(120, "Máximo 120 caracteres")
.email("Correo no válido")
.optional()
.or(z.literal("")),
telefono: z
.string()
.trim()
.regex(/^[0-9+\-\s]{7,20}$/i, "Teléfono no válido")
.optional()
.or(z.literal("")),
direccion: z.string().trim().max(150, "Máximo 150 caracteres").optional().or(z.literal("")),
})

type ClienteFormValues = z.infer<typeof clienteSchema>

const dateFormatter = new Intl.DateTimeFormat("es-EC", {
dateStyle: "medium",
})

const defaultValues: ClienteFormValues = {
nombres: "",
apellidos: "",
cedula: "",
correo: "",
telefono: "",
direccion: "",
}

const defaultFilters: ClientesFilters = {
orden: "name_asc",
}

const sortLabelByValue: Record<ClientesFilters["orden"], string> = {
name_asc: "Nombre A-Z",
name_desc: "Nombre Z-A",
date_asc: "Fecha ",
date_desc: "Fecha ",
}

const getApiErrorMessage = (error: unknown, fallback: string) => {
if (isAxiosError<ApiErrorResponse>(error)) {
return error.response?.data?.error ?? error.response?.data?.message ?? error.message ?? fallback
}
if (error instanceof Error && error.message.trim()) return error.message
return fallback
}

export default function ClientesPage() {
const queryClient = useQueryClient()

const [pageSize, setPageSize] = useState<PageSizeOption>(() => {
const stored = localStorage.getItem(PAGE_SIZE_STORAGE_KEY)
if (stored) {
const parsed = Number(stored) as PageSizeOption
if (PAGE_SIZE_OPTIONS.includes(parsed)) return parsed
}
return DEFAULT_PAGE_SIZE
})

const [currentPage, setCurrentPage] = useState(1)
const [searchInput, setSearchInput] = useState("")
const [filters, setFilters] = useState<ClientesFilters>(defaultFilters)

const [filtersDrawerOpen, setFiltersDrawerOpen] = useState(false)
const [createDialogOpen, setCreateDialogOpen] = useState(false)
const [editDialogOpen, setEditDialogOpen] = useState(false)
const [detailDrawerOpen, setDetailDrawerOpen] = useState(false)

	const [exportingKey, setExportingKey] = useState<string | null>(null)

const [selectedCliente, setSelectedCliente] = useState<ClienteRecord | null>(null)
const [editingCliente, setEditingCliente] = useState<ClienteRecord | null>(null)

const debouncedSearch = useDebouncedValue(searchInput, 300)

const clientesQuery = useClientesQuery()
const clientes = useMemo(() => clientesQuery.data ?? [], [clientesQuery.data])

const form = useForm<ClienteFormValues>({
resolver: zodResolver(clienteSchema),
defaultValues,
})

const editForm = useForm<ClienteFormValues>({
resolver: zodResolver(clienteSchema),
defaultValues,
})

const createMutation = useMutation({
mutationFn: (payload: ClientePayload) => clienteClient.create(payload),
onSuccess: () => {
queryClient.invalidateQueries({ queryKey: clientesQueryKey })
setCreateDialogOpen(false)
form.reset(defaultValues)
},
})

const updateMutation = useMutation({
mutationFn: ({ id, payload }: { id: number; payload: ClientePayload }) => clienteClient.update(id, payload),
onSuccess: () => {
queryClient.invalidateQueries({ queryKey: clientesQueryKey })
setEditDialogOpen(false)
setEditingCliente(null)
editForm.reset(defaultValues)
},
})

	const exportMutation = useMutation({
		mutationFn: async (args: { scope: "page" | "all"; format: "pdf" | "xlsx" | "csv"; ids?: number[] }) => {
			const key = `${args.scope}-${args.format}`
			setExportingKey(key)
			try {
				await clienteClient.exportClientes({
					scope: args.scope,
					format: args.format,
					ids: args.scope === "page" ? args.ids : undefined,
				})
			} finally {
				setExportingKey(null)
			}
		},
		onError: () => {
			toast.error("No se pudo exportar clientes. Intenta nuevamente.")
		},
	})

	const exportSinglePdfMutation = useMutation({
		mutationFn: async (clienteId: number) => {
			setExportingKey(`single-${clienteId}`)
			try {
				await clienteClient.exportSingleClientePdf(clienteId)
			} finally {
				setExportingKey(null)
			}
		},
		onError: () => {
			toast.error("No se pudo exportar el cliente.")
		},
	})

const deleteMutation = useMutation({
mutationFn: (id: number) => clienteClient.remove(id),
onSuccess: () => {
queryClient.invalidateQueries({ queryKey: clientesQueryKey })
},
})

useEffect(() => {
localStorage.setItem(PAGE_SIZE_STORAGE_KEY, String(pageSize))
}, [pageSize])

useEffect(() => {
setCurrentPage(1)
}, [debouncedSearch, filters, pageSize])

useEffect(() => {
const handlePointerDownCapture = (event: PointerEvent) => {
const target = event.target
if (!(target instanceof Element)) return
if (target.closest("[data-clientes-actions-menu]")) return
document.querySelectorAll<HTMLDetailsElement>("[data-clientes-actions-menu][open]").forEach((node) => {
node.open = false
})
}

document.addEventListener("pointerdown", handlePointerDownCapture, true)
return () => {
document.removeEventListener("pointerdown", handlePointerDownCapture, true)
}
}, [])

const filteredClientes = useMemo(() => {
const result = clientes.filter((cliente) => matchesClienteSearch(cliente, debouncedSearch))

result.sort((a, b) => {
switch (filters.orden) {
case "name_asc":
return getClienteFullName(a).localeCompare(getClienteFullName(b))
case "name_desc":
return getClienteFullName(b).localeCompare(getClienteFullName(a))
case "date_asc":
return new Date(a.fecha_registro).getTime() - new Date(b.fecha_registro).getTime()
case "date_desc":
return new Date(b.fecha_registro).getTime() - new Date(a.fecha_registro).getTime()
}
})

return result
}, [clientes, debouncedSearch, filters.orden])

const totalPages = Math.max(1, Math.ceil(filteredClientes.length / pageSize))

useEffect(() => {
setCurrentPage((page) => Math.min(Math.max(page, 1), totalPages))
}, [totalPages])

const paginatedClientes = useMemo(() => {
const start = (currentPage - 1) * pageSize
return filteredClientes.slice(start, start + pageSize)
}, [filteredClientes, currentPage, pageSize])

const filterChips = useMemo<ClientesFilterChip[]>(() => {
const chips: ClientesFilterChip[] = []
if (filters.orden !== defaultFilters.orden) {
chips.push({ key: "orden", label: sortLabelByValue[filters.orden] })
}
return chips
}, [filters.orden])

const handleCreate = useCallback(
(values: ClienteFormValues) => {
const payload: ClientePayload = {
nombres: values.nombres,
apellidos: values.apellidos,
cedula: values.cedula,
correo: values.correo || null,
telefono: values.telefono || null,
direccion: values.direccion || null,
}
createMutation.mutate(payload)
},
[createMutation]
)

const handleEdit = useCallback(
(values: ClienteFormValues) => {
if (!editingCliente) return
const payload: ClientePayload = {
nombres: values.nombres,
apellidos: values.apellidos,
cedula: values.cedula,
correo: values.correo || null,
telefono: values.telefono || null,
direccion: values.direccion || null,
}
updateMutation.mutate({ id: editingCliente.id_cliente, payload })
},
[editingCliente, updateMutation]
)

const handleDelete = useCallback(
(cliente: ClienteRecord) => {
if (confirm(`¿Estás seguro de eliminar al cliente ${cliente.nombres} ${cliente.apellidos}?`)) {
deleteMutation.mutate(cliente.id_cliente)
}
},
[deleteMutation]
)

const handleOpenDetail = useCallback((cliente: ClienteRecord) => {
setSelectedCliente(cliente)
setDetailDrawerOpen(true)
}, [])

const handleOpenEdit = useCallback(
(cliente: ClienteRecord) => {
setEditingCliente(cliente)
editForm.reset({
nombres: cliente.nombres,
apellidos: cliente.apellidos,
cedula: cliente.cedula,
correo: cliente.correo || "",
telefono: cliente.telefono || "",
direccion: cliente.direccion || "",
})
setEditDialogOpen(true)
},
[editForm]
)

const startItem = filteredClientes.length === 0 ? 0 : (currentPage - 1) * pageSize + 1
const endItem =
filteredClientes.length === 0 ? 0 : Math.min(filteredClientes.length, (currentPage - 1) * pageSize + paginatedClientes.length)

return (
<div className="space-y-6">
<section aria-labelledby="clientes-encabezado" className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
<div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
<div>
<p id="clientes-encabezado" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
GESTIÓN
</p>
<h1 className="mt-1 text-3xl font-semibold text-slate-900">Clientes</h1>
<p className="mt-1 text-sm text-slate-500">Gestiona tus clientes y su información de contacto.</p>
</div>
<div className="flex flex-col items-center gap-2">
<p className="text-center text-xs font-semibold uppercase tracking-wide text-slate-500">Acciones rápidas</p>
<button
type="button"
onClick={() => setCreateDialogOpen(true)}
className="inline-flex items-center justify-center gap-2 rounded-full bg-emerald-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
aria-label="Nuevo cliente"
>
<Plus className="h-4 w-4" />
						Registrar cliente
</button>
</div>
</div>
</section>

<section aria-labelledby="clientes-resumen" className="space-y-3">
<div className="flex items-center justify-between">
<p id="clientes-resumen" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
Resumen
</p>
</div>
<div className="grid grid-cols-1 gap-4 md:grid-cols-3">
<article className="rounded-2xl border border-slate-200 bg-white p-5">
<p className="text-xs uppercase text-slate-500">Clientes registrados</p>
<p className="mt-2 text-3xl font-semibold text-slate-900">{clientes.length}</p>
<p className="text-sm text-slate-500">Total en el sistema</p>
</article>
<article className="rounded-2xl border border-slate-200 bg-white p-5">
<p className="text-xs uppercase text-slate-500">Clientes activos</p>
<p className="mt-2 text-3xl font-semibold text-slate-900">{clientes.length}</p>
<p className="text-sm text-slate-500">Disponibles para ventas</p>
</article>
<article className="rounded-2xl border border-slate-200 bg-white p-5">
<p className="text-xs uppercase text-slate-500">Nuevos este mes</p>
<p className="mt-2 text-3xl font-semibold text-slate-900">
{clientes.filter((cliente) => {
const regDate = new Date(cliente.fecha_registro)
const now = new Date()
return regDate.getMonth() === now.getMonth() && regDate.getFullYear() === now.getFullYear()
}).length}
</p>
<p className="text-sm text-slate-500">Registrados recientemente</p>
</article>
</div>
</section>

{clientesQuery.isError && (
<div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
<div className="flex items-center gap-2 font-medium">
<AlertCircle className="h-4 w-4" />
{getApiErrorMessage(clientesQuery.error, "Error al cargar clientes. Intenta nuevamente.")}
</div>
</div>
)}

<section aria-labelledby="clientes-listado" className="rounded-2xl border border-slate-200 bg-white">
<ClientesListHeader
startItem={startItem}
endItem={endItem}
resultsCount={filteredClientes.length}
searchInput={searchInput}
onSearchInputChange={setSearchInput}
onOpenFilters={() => setFiltersDrawerOpen(true)}
	onExport={(args) => {
		if (exportMutation.isPending) return
		if (args.scope === "all") {
			exportMutation.mutate({ scope: "all", format: args.format })
			return
		}

		// Página actual: snapshot EXACTO de lo visible (incluye búsqueda/orden/paginación del cliente).
		const ids = paginatedClientes.map((c) => c.id_cliente)
		exportMutation.mutate({ scope: "page", format: args.format, ids })
	}}
	exportingKey={exportingKey}
filterChips={filterChips}
onRemoveChip={(key) => {
if (key === "orden") setFilters((prev) => ({ ...prev, orden: defaultFilters.orden }))
}}
onClearAllFilters={() => setFilters(defaultFilters)}
/>

<div className="overflow-x-auto">
<table className="min-w-full divide-y divide-slate-200">
<thead className="bg-slate-50">
<tr>
<th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Cliente</th>
<th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Contacto</th>
<th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Fecha de registro</th>
<th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Acciones</th>
</tr>
</thead>
<tbody className="divide-y divide-slate-200 bg-white">
{clientesQuery.isLoading && clientesQuery.data === undefined
? Array.from({ length: Math.min(pageSize, 8) }).map((_, index) => (
<tr key={`clientes-skeleton-${index}`} className="animate-pulse">
<td className="px-6 py-4">
<div className="h-4 w-56 rounded bg-slate-100" />
<div className="mt-2 h-3 w-28 rounded bg-slate-100" />
</td>
<td className="px-6 py-4">
<div className="h-3 w-64 rounded bg-slate-100" />
<div className="mt-2 h-3 w-40 rounded bg-slate-100" />
<div className="mt-2 h-3 w-72 rounded bg-slate-100" />
</td>
<td className="px-6 py-4">
<div className="h-4 w-28 rounded bg-slate-100" />
</td>
<td className="px-6 py-4 text-right">
<div className="ml-auto h-10 w-28 rounded-xl bg-slate-100" />
</td>
</tr>
))
: paginatedClientes.map((cliente) => (
<tr key={cliente.id_cliente} className="hover:bg-slate-50">
<td className="px-6 py-4">
<p className="text-sm font-semibold text-slate-900">
{cliente.nombres} {cliente.apellidos}
</p>
<p className="text-xs text-slate-500">{cliente.cedula}</p>
</td>
<td className="px-6 py-4 text-sm text-slate-700">
<p className="font-semibold text-slate-900">{cliente.correo || ""}</p>
<p className="text-xs text-slate-500">{cliente.telefono || ""}</p>
<p className="mt-1 line-clamp-1 text-xs text-slate-500">{cliente.direccion || ""}</p>
</td>
<td className="px-6 py-4 text-sm text-slate-600">
{dateFormatter.format(new Date(cliente.fecha_registro))}
</td>
<td className="px-6 py-4 text-right">
<div className="flex items-center justify-end gap-3">
<button
type="button"
onClick={() => handleOpenDetail(cliente)}
className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
aria-label={`Ver cliente ${cliente.nombres} ${cliente.apellidos}`}
>
<Eye className="h-3.5 w-3.5" /> Ver
</button>
<details className="relative inline-block text-left" data-clientes-actions-menu>
<summary
className="inline-flex h-10 w-10 list-none items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
aria-label={`Más acciones para ${cliente.nombres} ${cliente.apellidos}`}
onClick={(event) => event.stopPropagation()}
>
<MoreHorizontal className="h-5 w-5" />
</summary>
<div
className="absolute right-0 z-10 mt-2 w-56 rounded-xl border border-slate-200 bg-white p-1.5 shadow-sm"
onClick={(event) => {
const details = (event.currentTarget.parentElement ?? null) as HTMLDetailsElement | null
if (details) details.open = false
}}
>
<button
type="button"
onClick={(event) => {
event.stopPropagation()
handleOpenEdit(cliente)
}}
className="w-full rounded-lg px-3 py-2.5 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50"
>
Editar
</button>
<button
type="button"
onClick={(event) => {
event.stopPropagation()
handleDelete(cliente)
}}
disabled={deleteMutation.isPending}
className="w-full rounded-lg px-3 py-2.5 text-left text-sm font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
>
<span className="inline-flex items-center gap-1">
<Trash2 className="h-3.5 w-3.5" /> Eliminar
</span>
</button>
</div>
</details>
</div>
</td>
</tr>
))}
</tbody>
</table>
</div>

{clientesQuery.isLoading && (
<div className="flex items-center justify-center gap-2 p-6 text-slate-500">
<Loader2 className="h-4 w-4 animate-spin" />
Cargando clientes...
</div>
)}

{!clientesQuery.isLoading && filteredClientes.length === 0 && (
<div className="p-8 text-center text-slate-500">
<Users size={36} className="mx-auto mb-2 opacity-50" />
{searchInput.trim() || filterChips.length ? "Sin resultados para los filtros actuales." : "Aún no registras clientes."}
</div>
)}

<div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 bg-white px-6 py-5">
<div className="text-sm font-medium text-slate-600">Página {Math.min(currentPage, totalPages)} de {totalPages}</div>
<div className="flex items-center gap-2">
<button
type="button"
onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
disabled={currentPage <= 1}
className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
>
Anterior
</button>
<span className="inline-flex h-10 min-w-10 items-center justify-center rounded-xl bg-slate-900 px-3 text-sm font-semibold text-white">
{Math.min(currentPage, totalPages)}
</span>
<button
type="button"
onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
disabled={currentPage >= totalPages}
className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
>
Siguiente
</button>
</div>
<div className="inline-flex items-center gap-3">
<label htmlFor="clientes-page-size-bottom" className="text-sm font-semibold text-slate-800">
Por página
</label>
<select
id="clientes-page-size-bottom"
value={String(pageSize)}
onChange={(event) => {
setPageSize(Number(event.target.value) as PageSizeOption)
setCurrentPage(1)
}}
className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
>
{PAGE_SIZE_OPTIONS.map((opt) => (
<option key={opt} value={opt}>
{opt}
</option>
))}
</select>
</div>
</div>
</section>

<ClientesFiltersDrawer
open={filtersDrawerOpen}
onOpenChange={setFiltersDrawerOpen}
filters={filters}
onFiltersChange={(next) => {
setFilters(next)
setCurrentPage(1)
}}
/>

<ClientesDetailDrawer
open={detailDrawerOpen}
onOpenChange={setDetailDrawerOpen}
cliente={selectedCliente}
dateFormatter={dateFormatter}
onEdit={() => {
if (selectedCliente) {
handleOpenEdit(selectedCliente)
setDetailDrawerOpen(false)
}
}}
	onExportPdf={() => {
		if (!selectedCliente) return
		exportSinglePdfMutation.mutate(selectedCliente.id_cliente)
	}}
	exportingPdf={Boolean(selectedCliente && exportingKey === `single-${selectedCliente.id_cliente}`)}
	exportDisabled={exportingKey !== null}
onClose={() => setDetailDrawerOpen(false)}
/>

<Dialog
open={createDialogOpen}
onOpenChange={(open) => {
if (!open) {
setCreateDialogOpen(false)
form.reset(defaultValues)
} else {
setCreateDialogOpen(true)
}
}}
>
<DialogContent className="w-full max-w-md max-h-[90vh] overflow-y-auto p-0 sm:rounded-3xl">
<DialogHeader className="border-b px-8 py-6 text-left">
<DialogTitle className="text-2xl font-semibold text-slate-900">Registrar cliente</DialogTitle>
<DialogDescription>Agrega un nuevo cliente al sistema.</DialogDescription>
</DialogHeader>
<div className="px-8 py-6">
{createMutation.isError && (
<div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
{getApiErrorMessage(createMutation.error, "No se pudo registrar el cliente")}
</div>
)}
<form onSubmit={form.handleSubmit(handleCreate)} className="space-y-6">
<div className="grid grid-cols-2 gap-4">
<div>
<label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Nombres</label>
<input
{...form.register("nombres")}
className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
/>
{form.formState.errors.nombres && (
<p className="mt-1 text-xs text-red-600">{form.formState.errors.nombres.message}</p>
)}
</div>
<div>
<label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Apellidos</label>
<input
{...form.register("apellidos")}
className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
/>
{form.formState.errors.apellidos && (
<p className="mt-1 text-xs text-red-600">{form.formState.errors.apellidos.message}</p>
)}
</div>
</div>
<div>
<label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Cédula</label>
<input
{...form.register("cedula")}
className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
/>
{form.formState.errors.cedula && (
<p className="mt-1 text-xs text-red-600">{form.formState.errors.cedula.message}</p>
)}
</div>
<div>
<label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Correo</label>
<input
{...form.register("correo")}
type="email"
className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
/>
{form.formState.errors.correo && (
<p className="mt-1 text-xs text-red-600">{form.formState.errors.correo.message}</p>
)}
</div>
<div>
<label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Teléfono</label>
<input
{...form.register("telefono")}
className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
/>
{form.formState.errors.telefono && (
<p className="mt-1 text-xs text-red-600">{form.formState.errors.telefono.message}</p>
)}
</div>
<div>
<label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Dirección</label>
<textarea
{...form.register("direccion")}
rows={3}
className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
/>
{form.formState.errors.direccion && (
<p className="mt-1 text-xs text-red-600">{form.formState.errors.direccion.message}</p>
)}
</div>
<div className="flex justify-end gap-3">
<button
type="button"
onClick={() => setCreateDialogOpen(false)}
className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
>
Cancelar
</button>
<button
type="submit"
disabled={createMutation.isPending}
className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
>
{createMutation.isPending && <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />}
Crear Cliente
</button>
</div>
</form>
</div>
</DialogContent>
</Dialog>

<Dialog
open={editDialogOpen}
onOpenChange={(open) => {
if (!open) {
setEditDialogOpen(false)
setEditingCliente(null)
editForm.reset(defaultValues)
} else {
setEditDialogOpen(true)
}
}}
>
<DialogContent className="w-full max-w-md max-h-[90vh] overflow-y-auto p-0 sm:rounded-3xl">
<DialogHeader className="border-b px-8 py-6 text-left">
<DialogTitle className="text-2xl font-semibold text-slate-900">Editar cliente</DialogTitle>
<DialogDescription>Modifica la información del cliente.</DialogDescription>
</DialogHeader>
<div className="px-8 py-6">
{updateMutation.isError && (
<div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
{getApiErrorMessage(updateMutation.error, "No se pudo actualizar el cliente")}
</div>
)}
<form onSubmit={editForm.handleSubmit(handleEdit)} className="space-y-6">
<div className="grid grid-cols-2 gap-4">
<div>
<label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Nombres</label>
<input
{...editForm.register("nombres")}
className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
/>
{editForm.formState.errors.nombres && (
<p className="mt-1 text-xs text-red-600">{editForm.formState.errors.nombres.message}</p>
)}
</div>
<div>
<label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Apellidos</label>
<input
{...editForm.register("apellidos")}
className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
/>
{editForm.formState.errors.apellidos && (
<p className="mt-1 text-xs text-red-600">{editForm.formState.errors.apellidos.message}</p>
)}
</div>
</div>
<div>
<label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Cédula</label>
<input
{...editForm.register("cedula")}
className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
/>
{editForm.formState.errors.cedula && (
<p className="mt-1 text-xs text-red-600">{editForm.formState.errors.cedula.message}</p>
)}
</div>
<div>
<label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Correo</label>
<input
{...editForm.register("correo")}
type="email"
className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
/>
{editForm.formState.errors.correo && (
<p className="mt-1 text-xs text-red-600">{editForm.formState.errors.correo.message}</p>
)}
</div>
<div>
<label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Teléfono</label>
<input
{...editForm.register("telefono")}
className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
/>
{editForm.formState.errors.telefono && (
<p className="mt-1 text-xs text-red-600">{editForm.formState.errors.telefono.message}</p>
)}
</div>
<div>
<label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Dirección</label>
<textarea
{...editForm.register("direccion")}
rows={3}
className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
/>
{editForm.formState.errors.direccion && (
<p className="mt-1 text-xs text-red-600">{editForm.formState.errors.direccion.message}</p>
)}
</div>
<div className="flex justify-end gap-3">
<button
type="button"
onClick={() => setEditDialogOpen(false)}
className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
>
Cancelar
</button>
<button
type="submit"
disabled={updateMutation.isPending}
className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
>
{updateMutation.isPending && <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />}
Guardar Cambios
</button>
</div>
</form>
</div>
</DialogContent>
</Dialog>
</div>
)
}

"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { isAxiosError } from "axios"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import {
	AlertCircle,
	Building2,
	Eye,
	Loader2,
	MoreHorizontal,
	Plus,
	Trash2,
} from "lucide-react"
import { toast } from "sonner"

import { useAuthUser } from "../../lib/hooks/useAuthUser"
import { useDebouncedValue } from "../../lib/hooks/useDebouncedValue"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../../components/ui/dialog"
import { detectEcuadorIdType, validateEcuadorId } from "./ecuadorId"

import type { ProveedoresFilters, ProveedorPayload, ProveedorRecord } from "./proveedor.types"
import { proveedorClient } from "./proveedor.client"
import { matchesProveedorSearch } from "./proveedor.utils"
import { proveedoresQueryKey, useProveedoresQuery } from "./useProveedoresQuery"

import { ProveedoresFiltersDrawer } from "./components/ProveedoresFiltersDrawer"
import { ProveedoresListHeader } from "./components/ProveedoresListHeader"
import { ProveedoresDetailDrawer } from "./components/ProveedoresDetailDrawer"

type ApiErrorResponse = {
	error?: string
	message?: string
}

const PAGE_SIZE_STORAGE_KEY = "proveedores.pageSize"
const PAGE_SIZE_OPTIONS = [10, 20, 30, 40] as const
type PageSizeOption = (typeof PAGE_SIZE_OPTIONS)[number]
const DEFAULT_PAGE_SIZE: PageSizeOption = 20

const proveedorSchema = z.object({
	nombre_proveedor: z.string().trim().min(3, "El nombre es obligatorio").max(100, "Máximo 100 caracteres"),
	ruc_cedula: z.string().trim(),
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
	direccion: z
		.string()
		.trim()
		.max(150, "Máximo 150 caracteres")
		.optional()
		.or(z.literal("")),
}).superRefine((data, ctx) => {
	const validation = validateEcuadorId(data.ruc_cedula)
	if (!validation.isValid) {
		ctx.addIssue({
			code: z.ZodIssueCode.custom,
			message: validation.error || "RUC/Cédula inválido",
			path: ["ruc_cedula"],
		})
	}
})

type ProveedorFormValues = z.infer<typeof proveedorSchema>

const dateFormatter = new Intl.DateTimeFormat("es-EC", {
	dateStyle: "medium",
})

const defaultValues: ProveedorFormValues = {
	nombre_proveedor: "",
	ruc_cedula: "",
	correo: "",
	telefono: "",
	direccion: "",
}

const defaultFilters: ProveedoresFilters = {
	estado: "all",
	tipoId: "all",
	fechaDesde: "",
	fechaHasta: "",
	orden: "name_asc",
}

const getApiErrorMessage = (error: unknown, fallback: string) => {
	if (isAxiosError<ApiErrorResponse>(error)) {
		return error.response?.data?.error ?? error.response?.data?.message ?? error.message ?? fallback
	}
	if (error instanceof Error && error.message.trim()) return error.message
	return fallback
}

export default function ProveedoresPage() {
	const { isAdmin } = useAuthUser()
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
	const [filters, setFilters] = useState<ProveedoresFilters>(defaultFilters)

	const [filtersDrawerOpen, setFiltersDrawerOpen] = useState(false)
	const [filtersDraft, setFiltersDraft] = useState<ProveedoresFilters>(filters)
	const [createDialogOpen, setCreateDialogOpen] = useState(false)
	const [editDialogOpen, setEditDialogOpen] = useState(false)
	const [detailDrawerOpen, setDetailDrawerOpen] = useState(false)
	const [exportingKey, setExportingKey] = useState<string | null>(null)
	const [selectedProveedor, setSelectedProveedor] = useState<ProveedorRecord | null>(null)
	const [editingProveedor, setEditingProveedor] = useState<ProveedorRecord | null>(null)

	const debouncedSearch = useDebouncedValue(searchInput, 300)

	const proveedoresQuery = useProveedoresQuery()
	const proveedores = useMemo(() => proveedoresQuery.data ?? [], [proveedoresQuery.data])

	const createMutation = useMutation({
		mutationFn: (payload: ProveedorPayload) => proveedorClient.create(payload),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: proveedoresQueryKey })
			setCreateDialogOpen(false)
			form.reset(defaultValues)
		},
	})

	const updateMutation = useMutation({
		mutationFn: ({ id, payload }: { id: number; payload: ProveedorPayload }) =>
			proveedorClient.update(id, payload),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: proveedoresQueryKey })
			setEditDialogOpen(false)
			setEditingProveedor(null)
			editForm.reset(defaultValues)
		},
	})

	const deleteMutation = useMutation({
		mutationFn: (id: number) => proveedorClient.remove(id),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: proveedoresQueryKey })
		},
	})

	const exportMutation = useMutation({
		mutationFn: async (args: { scope: "page" | "all"; format: "pdf" | "xlsx" | "csv"; ids?: number[] }) => {
			const key = `${args.scope}-${args.format}`
			setExportingKey(key)
			try {
				await proveedorClient.exportProveedores({
					scope: args.scope,
					format: args.format,
					ids: args.scope === "page" ? args.ids : undefined,
				})
			} finally {
				setExportingKey(null)
			}
		},
		onError: () => {
			toast.error("No se pudo exportar proveedores. Intenta nuevamente.")
		},
	})

	const exportSinglePdfMutation = useMutation({
		mutationFn: async (proveedorId: number) => {
			setExportingKey(`single-${proveedorId}`)
			try {
				await proveedorClient.exportSingleProveedorPdf(proveedorId)
			} finally {
				setExportingKey(null)
			}
		},
		onError: () => {
			toast.error("No se pudo exportar el proveedor.")
		},
	})

	const form = useForm<ProveedorFormValues>({
		resolver: zodResolver(proveedorSchema),
		defaultValues,
	})

	const editForm = useForm<ProveedorFormValues>({
		resolver: zodResolver(proveedorSchema),
		defaultValues,
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
			if (target.closest("[data-proveedores-actions-menu]")) return
			document.querySelectorAll<HTMLDetailsElement>("[data-proveedores-actions-menu][open]").forEach((node) => {
				node.open = false
			})
		}

		document.addEventListener("pointerdown", handlePointerDownCapture, true)
		return () => {
			document.removeEventListener("pointerdown", handlePointerDownCapture, true)
		}
	}, [])

	const filteredProveedores = useMemo(() => {
		const normalizedSearch = debouncedSearch.trim()
		const fromDate = filters.fechaDesde ? new Date(`${filters.fechaDesde}T00:00:00`) : null
		const toDate = filters.fechaHasta ? new Date(`${filters.fechaHasta}T23:59:59.999`) : null

		const result = proveedores
			.filter((proveedor) => matchesProveedorSearch(proveedor, normalizedSearch))
			.filter((proveedor) => {
				if (filters.estado === "all") return true
				const estado = proveedor.id_estado ?? 1
				return filters.estado === "active" ? estado === 1 : estado !== 1
			})
			.filter((proveedor) => {
				if (filters.tipoId === "all") return true
				const type = detectEcuadorIdType(proveedor.ruc_cedula)
				if (filters.tipoId === "cedula") return type === "cedula"
				return type === "ruc_natural"
			})
			.filter((proveedor) => {
				if (!fromDate && !toDate) return true
				const regDate = new Date(proveedor.fecha_registro)
				if (fromDate && regDate < fromDate) return false
				if (toDate && regDate > toDate) return false
				return true
			})

		// Aplicar ordenamiento
		result.sort((a, b) => {
			switch (filters.orden) {
				case "name_asc":
					return a.nombre_proveedor.localeCompare(b.nombre_proveedor)
				case "name_desc":
					return b.nombre_proveedor.localeCompare(a.nombre_proveedor)
				case "date_asc":
					return new Date(a.fecha_registro).getTime() - new Date(b.fecha_registro).getTime()
				case "date_desc":
					return new Date(b.fecha_registro).getTime() - new Date(a.fecha_registro).getTime()
				default:
					return 0
			}
		})

		return result
	}, [proveedores, debouncedSearch, filters])

	const paginatedProveedores = useMemo(() => {
		const start = (currentPage - 1) * pageSize
		const end = start + pageSize
		return filteredProveedores.slice(start, end)
	}, [filteredProveedores, currentPage, pageSize])

	const totalPages = Math.max(1, Math.ceil(filteredProveedores.length / pageSize))

	const filterChips = useMemo(() => {
		const chips: { key: "estado" | "tipoId" | "fecha" | "orden"; label: string }[] = []

		if (filters.estado !== defaultFilters.estado) {
			chips.push({ key: "estado", label: `Estado: ${filters.estado === "active" ? "Activo" : "Inactivo"}` })
		}

		if (filters.tipoId !== defaultFilters.tipoId) {
			chips.push({ key: "tipoId", label: `ID: ${filters.tipoId === "ruc" ? "RUC" : "Cédula"}` })
		}

		if (filters.fechaDesde || filters.fechaHasta) {
			const label =
				filters.fechaDesde && filters.fechaHasta
					? `Fecha: ${filters.fechaDesde} → ${filters.fechaHasta}`
					: filters.fechaDesde
						? `Fecha desde: ${filters.fechaDesde}`
						: `Fecha hasta: ${filters.fechaHasta}`
			chips.push({ key: "fecha", label })
		}

		if (filters.orden !== defaultFilters.orden) {
			const label =
				filters.orden === "name_asc"
					? "Nombre A-Z"
					: filters.orden === "name_desc"
						? "Nombre Z-A"
						: filters.orden === "date_asc"
							? "Fecha ↑"
							: "Fecha ↓"
			chips.push({ key: "orden", label })
		}
		return chips
	}, [filters])

	const handleCreate = useCallback(
		(values: ProveedorFormValues) => {
			const payload: ProveedorPayload = {
				nombre_proveedor: values.nombre_proveedor,
				ruc_cedula: values.ruc_cedula,
				correo: values.correo || null,
				telefono: values.telefono || null,
				direccion: values.direccion || null,
			}
			createMutation.mutate(payload)
		},
		[createMutation]
	)

	const handleEdit = useCallback(
		(values: ProveedorFormValues) => {
			if (!editingProveedor) return
			const payload: ProveedorPayload = {
				nombre_proveedor: values.nombre_proveedor,
				ruc_cedula: values.ruc_cedula,
				correo: values.correo || null,
				telefono: values.telefono || null,
				direccion: values.direccion || null,
			}
			updateMutation.mutate({ id: editingProveedor.id_proveedor, payload })
		},
		[editingProveedor, updateMutation]
	)

	const handleDelete = useCallback(
		(proveedor: ProveedorRecord) => {
			if (confirm(`¿Estás seguro de eliminar al proveedor ${proveedor.nombre_proveedor}?`)) {
				deleteMutation.mutate(proveedor.id_proveedor)
			}
		},
		[deleteMutation]
	)

	const handleOpenDetail = useCallback((proveedor: ProveedorRecord) => {
		setSelectedProveedor(proveedor)
		setDetailDrawerOpen(true)
	}, [])

	const handleOpenEdit = useCallback((proveedor: ProveedorRecord) => {
		setEditingProveedor(proveedor)
		editForm.reset({
			nombre_proveedor: proveedor.nombre_proveedor,
			ruc_cedula: proveedor.ruc_cedula,
			correo: proveedor.correo || "",
			telefono: proveedor.telefono || "",
			direccion: proveedor.direccion || "",
		})
		setEditDialogOpen(true)
	}, [editForm])

	const startItem = filteredProveedores.length === 0 ? 0 : (currentPage - 1) * pageSize + 1
	const endItem =
		filteredProveedores.length === 0
			? 0
			: Math.min(filteredProveedores.length, (currentPage - 1) * pageSize + paginatedProveedores.length)

	return (
		<div className="space-y-6">
			<section aria-labelledby="proveedores-encabezado" className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
				<div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
					<div>
						<p id="proveedores-encabezado" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
							GESTIÓN
						</p>
						<h1 className="mt-1 text-3xl font-semibold text-slate-900">Proveedores</h1>
						<p className="mt-1 text-sm text-slate-500">Administra tus proveedores y su información de contacto.</p>
					</div>
					<div className="flex flex-col items-center gap-2">
						<p className="text-center text-xs font-semibold uppercase tracking-wide text-slate-500">Acciones rápidas</p>
						<button
							type="button"
							onClick={() => setCreateDialogOpen(true)}
							disabled={!isAdmin}
							className="inline-flex items-center justify-center gap-2 rounded-full bg-emerald-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
							aria-label="Nuevo proveedor"
						>
							<Plus className="h-4 w-4" />
							Registrar proveedor
						</button>
					</div>
				</div>
			</section>

			<section aria-labelledby="proveedores-resumen" className="space-y-3">
				<div className="flex items-center justify-between">
					<p id="proveedores-resumen" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
						Resumen
					</p>
				</div>
				<div className="grid grid-cols-1 gap-4 md:grid-cols-3">
					<article className="rounded-2xl border border-slate-200 bg-white p-5">
						<p className="text-xs uppercase text-slate-500">Proveedores registrados</p>
						<p className="mt-2 text-3xl font-semibold text-slate-900">{proveedores.length}</p>
						<p className="text-sm text-slate-500">Total en el sistema</p>
					</article>
					<article className="rounded-2xl border border-slate-200 bg-white p-5">
						<p className="text-xs uppercase text-slate-500">Proveedores activos</p>
						<p className="mt-2 text-3xl font-semibold text-slate-900">{proveedores.length}</p>
						<p className="text-sm text-slate-500">Disponibles para compras</p>
					</article>
					<article className="rounded-2xl border border-slate-200 bg-white p-5">
						<p className="text-xs uppercase text-slate-500">Nuevos este mes</p>
						<p className="mt-2 text-3xl font-semibold text-slate-900">
							{proveedores.filter((proveedor) => {
								const regDate = new Date(proveedor.fecha_registro)
								const now = new Date()
								return regDate.getMonth() === now.getMonth() && regDate.getFullYear() === now.getFullYear()
							}).length}
						</p>
						<p className="text-sm text-slate-500">Registrados recientemente</p>
					</article>
				</div>
			</section>

			{proveedoresQuery.isError && (
				<div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
					<div className="flex items-center gap-2 font-medium">
						<AlertCircle className="h-4 w-4" />
						{getApiErrorMessage(proveedoresQuery.error, "Error al cargar proveedores. Intenta nuevamente.")}
					</div>
				</div>
			)}

			<section aria-labelledby="proveedores-listado" className="rounded-2xl border border-slate-200 bg-white">
				<ProveedoresListHeader
					startItem={startItem}
					endItem={endItem}
					resultsCount={filteredProveedores.length}
					searchInput={searchInput}
					onSearchInputChange={setSearchInput}
					onOpenFilters={() => setFiltersDrawerOpen(true)}
					onExport={(args) => {
						if (exportMutation.isPending) return
						if (args.scope === "all") {
							exportMutation.mutate({ scope: "all", format: args.format })
							return
						}

						const ids = paginatedProveedores.map((p) => p.id_proveedor)
						exportMutation.mutate({ scope: "page", format: args.format, ids })
					}}
					exportingKey={exportingKey}
					filterChips={filterChips}
					onRemoveChip={(key) => {
						if (key === "orden") {
							setFilters((prev) => ({ ...prev, orden: defaultFilters.orden }))
						}
					}}
					onClearAllFilters={() => setFilters(defaultFilters)}
				/>

				<div className="overflow-x-auto">
					<table className="min-w-full divide-y divide-slate-200">
						<thead className="bg-slate-50">
							<tr>
								<th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
									Proveedor
								</th>
								<th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
									Contacto
								</th>
								<th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
									Fecha de registro
								</th>
								<th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
									Acciones
								</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-slate-200 bg-white">
							{proveedoresQuery.isLoading && proveedoresQuery.data === undefined
								? Array.from({ length: Math.min(pageSize, 8) }).map((_, index) => (
										<tr key={`proveedores-skeleton-${index}`} className="animate-pulse">
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
								: paginatedProveedores.map((proveedor) => (
										<tr key={proveedor.id_proveedor} className="hover:bg-slate-50">
											<td className="px-6 py-4">
												<p className="text-sm font-semibold text-slate-900">{proveedor.nombre_proveedor}</p>
												<p className="text-xs text-slate-500">{proveedor.ruc_cedula}</p>
											</td>
											<td className="px-6 py-4 text-sm text-slate-700">
												<p className="font-semibold text-slate-900">{proveedor.correo || ""}</p>
												<p className="text-xs text-slate-500">{proveedor.telefono || ""}</p>
												<p className="mt-1 line-clamp-1 text-xs text-slate-500">{proveedor.direccion || ""}</p>
											</td>
											<td className="px-6 py-4 text-sm text-slate-600">
												{dateFormatter.format(new Date(proveedor.fecha_registro))}
											</td>
											<td className="px-6 py-4 text-right">
												<div className="flex items-center justify-end gap-3">
													<button
														type="button"
														onClick={() => handleOpenDetail(proveedor)}
														className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
														aria-label={`Ver proveedor ${proveedor.nombre_proveedor}`}
													>
														<Eye className="h-3.5 w-3.5" /> Ver
													</button>
													<details className="relative inline-block text-left" data-proveedores-actions-menu>
														<summary
															className="inline-flex h-10 w-10 list-none items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
															aria-label={`Más acciones para ${proveedor.nombre_proveedor}`}
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
																	handleOpenEdit(proveedor)
																}}
																disabled={!isAdmin}
																className="w-full rounded-lg px-3 py-2.5 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
															>
																Editar
															</button>
															<button
																type="button"
																onClick={(event) => {
																	event.stopPropagation()
																	handleDelete(proveedor)
																}}
																disabled={!isAdmin || deleteMutation.isPending}
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

				{/* Estados de carga y vacío */}
				{proveedoresQuery.isLoading && (
					<div className="flex items-center justify-center gap-2 p-6 text-slate-500">
						<Loader2 className="h-4 w-4 animate-spin" />
						Cargando proveedores...
					</div>
				)}

				{!proveedoresQuery.isLoading && filteredProveedores.length === 0 && (
					<div className="p-8 text-center text-slate-500">
						<Building2 size={36} className="mx-auto mb-2 opacity-50" />
						{searchInput.trim() || filterChips.length ? "Sin resultados para los filtros actuales." : "Aún no registras proveedores."}
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
						<label htmlFor="proveedores-page-size-bottom" className="text-sm font-semibold text-slate-800">
							Por página
						</label>
						<select
							id="proveedores-page-size-bottom"
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

			{/* Drawers y Dialogs */}
			<ProveedoresFiltersDrawer
				open={filtersDrawerOpen}
				onOpenChange={(open) => {
					if (!open) {
						setFiltersDraft(filters)
					}
					setFiltersDrawerOpen(open)
				}}
				filtersDraft={filtersDraft}
				setFiltersDraft={setFiltersDraft}
				onApply={() => {
					setFilters(filtersDraft)
					setFiltersDrawerOpen(false)
				}}
				onCancel={() => {
					setFiltersDraft(filters)
					setFiltersDrawerOpen(false)
				}}
				onClearDraft={() => setFiltersDraft(defaultFilters)}
			/>

			<ProveedoresDetailDrawer
				open={detailDrawerOpen}
				onOpenChange={setDetailDrawerOpen}
				proveedor={selectedProveedor}
				dateFormatter={dateFormatter}
				onEdit={() => {
					if (selectedProveedor) {
						handleOpenEdit(selectedProveedor)
						setDetailDrawerOpen(false)
					}
				}}
				onExportPdf={() => {
					if (!selectedProveedor) return
					exportSinglePdfMutation.mutate(selectedProveedor.id_proveedor)
				}}
				exportingPdf={Boolean(selectedProveedor && exportingKey === `single-${selectedProveedor.id_proveedor}`)}
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
						<DialogTitle className="text-2xl font-semibold text-slate-900">Registrar proveedor</DialogTitle>
						<DialogDescription>Agrega un nuevo proveedor al sistema.</DialogDescription>
					</DialogHeader>
					<div className="px-8 py-6">
						{createMutation.isError && (
							<div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
								{getApiErrorMessage(createMutation.error, "No se pudo registrar el proveedor")}
							</div>
						)}
						<form onSubmit={form.handleSubmit(handleCreate)} className="space-y-6">
							<div>
								<label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
									Nombre del Proveedor
								</label>
								<input
									{...form.register("nombre_proveedor")}
									className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
								/>
								{form.formState.errors.nombre_proveedor && (
									<p className="mt-1 text-xs text-red-600">{form.formState.errors.nombre_proveedor.message}</p>
								)}
							</div>
							<div>
								<label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
									RUC/Cédula
								</label>
								<input
									{...form.register("ruc_cedula")}
									className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
								/>
								{form.formState.errors.ruc_cedula && (
									<p className="mt-1 text-xs text-red-600">{form.formState.errors.ruc_cedula.message}</p>
								)}
							</div>
							<div>
								<label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
									Correo
								</label>
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
								<label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
									Teléfono
								</label>
								<input
									{...form.register("telefono")}
									className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
								/>
								{form.formState.errors.telefono && (
									<p className="mt-1 text-xs text-red-600">{form.formState.errors.telefono.message}</p>
								)}
							</div>
							<div>
								<label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
									Dirección
								</label>
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
									Crear Proveedor
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
						setEditingProveedor(null)
						editForm.reset(defaultValues)
					} else {
						setEditDialogOpen(true)
					}
				}}
			>
				<DialogContent className="w-full max-w-md max-h-[90vh] overflow-y-auto p-0 sm:rounded-3xl">
					<DialogHeader className="border-b px-8 py-6 text-left">
						<DialogTitle className="text-2xl font-semibold text-slate-900">Editar proveedor</DialogTitle>
						<DialogDescription>Modifica la información del proveedor.</DialogDescription>
					</DialogHeader>
					<div className="px-8 py-6">
						{updateMutation.isError && (
							<div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
								{getApiErrorMessage(updateMutation.error, "No se pudo actualizar el proveedor")}
							</div>
						)}
						<form onSubmit={editForm.handleSubmit(handleEdit)} className="space-y-6">
							<div>
								<label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
									Nombre del Proveedor
								</label>
								<input
									{...editForm.register("nombre_proveedor")}
									className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
								/>
								{editForm.formState.errors.nombre_proveedor && (
									<p className="mt-1 text-xs text-red-600">{editForm.formState.errors.nombre_proveedor.message}</p>
								)}
							</div>
							<div>
								<label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
									RUC/Cédula
								</label>
								<input
									{...editForm.register("ruc_cedula")}
									className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
								/>
								{editForm.formState.errors.ruc_cedula && (
									<p className="mt-1 text-xs text-red-600">{editForm.formState.errors.ruc_cedula.message}</p>
								)}
							</div>
							<div>
								<label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
									Correo
								</label>
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
								<label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
									Teléfono
								</label>
								<input
									{...editForm.register("telefono")}
									className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
								/>
								{editForm.formState.errors.telefono && (
									<p className="mt-1 text-xs text-red-600">{editForm.formState.errors.telefono.message}</p>
								)}
							</div>
							<div>
								<label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
									Dirección
								</label>
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

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
	Edit2,
	Loader2,
	Mail,
	MapPin,
	Phone,
	Trash2,
} from "lucide-react"

import { useAuthUser } from "../../lib/hooks/useAuthUser"
import { useDebouncedValue } from "../../lib/hooks/useDebouncedValue"
import { detectEcuadorIdType, formatEcuadorIdTypeLabel, validateEcuadorId } from "./ecuadorId"

import { exportToCSV, exportToPDF, exportToXLSX, type ExportRow } from "./exportProveedores"

import type { ProveedoresFilters } from "./proveedor.types"
import type { ProveedoresViewMode } from "./proveedor.types"
import type { ProveedorPayload, ProveedorRecord } from "./proveedor.types"
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
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const
type PageSizeOption = (typeof PAGE_SIZE_OPTIONS)[number]
const DEFAULT_PAGE_SIZE: PageSizeOption = 25

type ExportFormat = "csv" | "xlsx" | "pdf"
type ExportScope = "page" | "filtered" | "all"
type ExportStatus = "idle" | "exporting" | "done"

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
	const [exportDialogOpen, setExportDialogOpen] = useState(false)

	const [viewMode, setViewMode] = useState<ProveedoresViewMode>("table")

	const [exportFormat, setExportFormat] = useState<ExportFormat>("xlsx")
	const [exportScope, setExportScope] = useState<ExportScope>("filtered")
	const [exportStatus, setExportStatus] = useState<ExportStatus>("idle")
	const [exportError, setExportError] = useState<string | null>(null)
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

	const getSourceForExport = async (scope: "page" | "filtered" | "all") => {
		if (scope === "page") return paginatedProveedores
		if (scope === "filtered") return filteredProveedores
		// all
		if (proveedoresQuery.data) return proveedores
		const fetched = await queryClient.fetchQuery({
			queryKey: proveedoresQueryKey,
			queryFn: () => proveedorClient.list(),
		})
		return fetched ?? []
	}

	const buildExportRows = (records: ProveedorRecord[]): ExportRow[] => {
		return records.map((proveedor) => ({
			"ID Proveedor": proveedor.id_proveedor.toString(),
			"Nombre": proveedor.nombre_proveedor,
			"Cédula/RUC": proveedor.ruc_cedula,
			"Correo": proveedor.correo || "",
			"Teléfono": proveedor.telefono || "",
			"Dirección": proveedor.direccion || "",
			"Fecha Registro": dateFormatter.format(new Date(proveedor.fecha_registro)),
		}))
	}

	const runExport = async (): Promise<boolean> => {
		setExportError(null)
		setExportStatus("exporting")
		try {
			const source = await getSourceForExport(exportScope)
			const rows = buildExportRows(source)
			if (rows.length === 0) {
				setExportError("No hay proveedores para exportar")
				setExportStatus("idle")
				return false
			}
			const filenameBase = `proveedores_${exportScope}_${new Date().toISOString().split('T')[0]}`
			switch (exportFormat) {
				case "csv":
					exportToCSV(rows, filenameBase)
					break
				case "xlsx":
					exportToXLSX(rows, filenameBase)
					break
				case "pdf":
					exportToPDF(rows, filenameBase)
					break
			}
			setExportStatus("done")
			return true
		} catch (error) {
			setExportError(getApiErrorMessage(error, "No se pudo exportar"))
			setExportStatus("idle")
			return false
		}
	}

	const startItem = (currentPage - 1) * pageSize + 1
	const endItem = Math.min(currentPage * pageSize, filteredProveedores.length)

	return (
		<div className="space-y-8">
			<header className="flex flex-wrap items-center justify-between gap-3">
				<div>
					<p className="text-xs uppercase tracking-wide text-slate-500">Gestión</p>
					<h1 className="text-3xl font-semibold text-slate-900">Proveedores</h1>
					<p className="mt-1 text-sm text-slate-500">Administra la información de tus proveedores.</p>
				</div>
			</header>

			<section className="grid grid-cols-1 gap-4 md:grid-cols-3">
				<article className="rounded-2xl border border-slate-200 bg-white p-5">
					<p className="text-xs uppercase text-slate-500">Proveedores registrados</p>
					<p className="mt-2 text-3xl font-semibold text-slate-900">{filteredProveedores.length}</p>
					<p className="text-sm text-slate-500">Total en el sistema</p>
				</article>
				<article className="rounded-2xl border border-slate-200 bg-white p-5">
					<p className="text-xs uppercase text-slate-500">Proveedores activos</p>
					<p className="mt-2 text-3xl font-semibold text-blue-600">{filteredProveedores.length}</p>
					<p className="text-sm text-slate-500">Disponibles para compras</p>
				</article>
				<article className="rounded-2xl border border-slate-200 bg-white p-5">
					<p className="text-xs uppercase text-slate-500">Nuevos este mes</p>
					<p className="mt-2 text-3xl font-semibold text-purple-600">
						{filteredProveedores.filter(p => {
							const regDate = new Date(p.fecha_registro)
							const now = new Date()
							return regDate.getMonth() === now.getMonth() && regDate.getFullYear() === now.getFullYear()
						}).length}
					</p>
					<p className="text-sm text-slate-500">Registrados recientemente</p>
				</article>
			</section>

			{proveedoresQuery.isError && (
				<div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
					<div className="flex items-center gap-2 font-medium">
						<AlertCircle className="h-4 w-4" />
						Error al cargar proveedores. Intenta nuevamente.
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
					viewMode={viewMode}
					onChangeViewMode={setViewMode}
					pageSize={pageSize}
					onChangePageSize={(next) => {
						setPageSize(next as PageSizeOption)
						setCurrentPage(1)
					}}
					onOpenCreate={() => setCreateDialogOpen(true)}
					createDisabled={!isAdmin}
					onOpenExport={() => setExportDialogOpen(true)}
					filterChips={filterChips}
					onRemoveChip={(key) => {
						if (key === "orden") {
							setFilters((prev) => ({ ...prev, orden: defaultFilters.orden }))
						}
					}}
					onClearAllFilters={() => setFilters(defaultFilters)}
				/>

				{viewMode === "table" ? (
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
										Fecha Registro
									</th>
									<th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
										Acciones
									</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-slate-200 bg-white">
								{paginatedProveedores.map((proveedor) => (
									<tr key={proveedor.id_proveedor} className="hover:bg-slate-50">
										<td className="px-6 py-4">
											<div className="flex items-center gap-3">
												<div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100">
													<Building2 className="h-5 w-5 text-slate-600" />
												</div>
												<div>
													<p className="font-medium text-slate-900">
														{proveedor.nombre_proveedor}
													</p>
													<p className="text-sm text-slate-500">
														{proveedor.ruc_cedula} ({formatEcuadorIdTypeLabel(detectEcuadorIdType(proveedor.ruc_cedula))})
													</p>
												</div>
											</div>
										</td>
										<td className="px-6 py-4">
											<div className="space-y-1">
												{proveedor.correo && (
													<div className="flex items-center gap-2 text-sm text-slate-600">
														<Mail className="h-4 w-4" />
														{proveedor.correo}
													</div>
												)}
												{proveedor.telefono && (
													<div className="flex items-center gap-2 text-sm text-slate-600">
														<Phone className="h-4 w-4" />
														{proveedor.telefono}
													</div>
												)}
												{proveedor.direccion && (
													<div className="flex items-center gap-2 text-sm text-slate-600">
														<MapPin className="h-4 w-4" />
														{proveedor.direccion}
													</div>
												)}
											</div>
										</td>
										<td className="px-6 py-4 text-sm text-slate-600">
											{dateFormatter.format(new Date(proveedor.fecha_registro))}
										</td>
										<td className="px-6 py-4 text-right">
											<div className="flex items-center justify-end gap-2">
												<button
													onClick={() => handleOpenDetail(proveedor)}
													className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-sm font-medium shadow-sm transition-colors hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-950"
												>
													<svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
														<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
														<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
													</svg>
												</button>
												<button
													onClick={() => handleOpenEdit(proveedor)}
													disabled={!isAdmin}
													className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-sm font-medium shadow-sm transition-colors hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-950"
												>
													<Edit2 className="h-4 w-4" />
												</button>
												<button
													onClick={() => handleDelete(proveedor)}
													disabled={!isAdmin}
													className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-red-200 bg-white text-sm font-medium text-red-600 shadow-sm transition-colors hover:bg-red-50 hover:text-red-700 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-red-950"
												>
													<Trash2 className="h-4 w-4" />
												</button>
											</div>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				) : (
					<div className="grid grid-cols-1 gap-4 p-6 md:grid-cols-2 lg:grid-cols-3">
						{paginatedProveedores.map((proveedor) => (
							<div key={proveedor.id_proveedor} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md transition">
								<div className="flex items-start justify-between">
									<div>
										<p className="font-semibold text-slate-900">{proveedor.nombre_proveedor}</p>
										<p className="text-sm text-slate-500">
											{proveedor.ruc_cedula} ({formatEcuadorIdTypeLabel(detectEcuadorIdType(proveedor.ruc_cedula))})
										</p>
									</div>
									<button
										onClick={() => handleOpenDetail(proveedor)}
										className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:border-slate-300 hover:text-slate-900"
									>
										<svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
											<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
											<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
										</svg>
									</button>
								</div>
								<div className="mt-3 space-y-2">
									{proveedor.correo && (
										<p className="text-sm text-slate-700">
											<span className="font-medium">Correo:</span> {proveedor.correo}
										</p>
									)}
									{proveedor.telefono && (
										<p className="text-sm text-slate-700">
											<span className="font-medium">Teléfono:</span> {proveedor.telefono}
										</p>
									)}
									<p className="text-sm text-slate-700">
										<span className="font-medium">Registro:</span> {dateFormatter.format(new Date(proveedor.fecha_registro))}
									</p>
								</div>
							</div>
						))}
					</div>
				)}

				{/* Estados de carga y vacío */}
				{proveedoresQuery.isLoading && (
					<div className="flex items-center justify-center gap-2 p-6 text-slate-500">
						<Loader2 className="h-4 w-4 animate-spin" />
						Cargando proveedores...
					</div>
				)}

				{!proveedoresQuery.isLoading && paginatedProveedores.length === 0 && filteredProveedores.length === 0 && (
					<div className="p-8 text-center text-slate-500">
						<Building2 size={36} className="mx-auto mb-2 opacity-50" />
						{searchInput.trim() || filterChips.length ? "Sin resultados para los filtros actuales." : "Aún no registras proveedores."}
					</div>
				)}

				{!proveedoresQuery.isLoading && paginatedProveedores.length === 0 && filteredProveedores.length > 0 && (
					<div className="p-8 text-center text-slate-500">
						<Building2 size={36} className="mx-auto mb-2 opacity-50" />
						<p>No se encontraron proveedores con los filtros aplicados.</p>
					</div>
				)}

				{/* Paginación */}
				{totalPages > 1 && (
					<div className="flex items-center justify-between border-t border-slate-200 bg-white px-6 py-3">
						<div className="flex items-center gap-2">
							<button
								onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
								disabled={currentPage === 1}
								className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900 disabled:opacity-50 disabled:cursor-not-allowed"
							>
								Anterior
							</button>
							<span className="text-sm text-slate-600">
								Página {currentPage} de {totalPages}
							</span>
							<button
								onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
								disabled={currentPage === totalPages}
								className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900 disabled:opacity-50 disabled:cursor-not-allowed"
							>
								Siguiente
							</button>
						</div>
					</div>
				)}
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
				onClose={() => setDetailDrawerOpen(false)}
			/>

			{/* Create Dialog */}
			{createDialogOpen && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setCreateDialogOpen(false)}>
					<div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-8" onClick={(e) => e.stopPropagation()}>
						<div className="mb-6">
							<h2 className="text-xl font-semibold text-slate-900">Registrar proveedor</h2>
							<p className="text-sm text-slate-600">Agrega un nuevo proveedor al sistema.</p>
						</div>

						{createMutation.isError && (
							<div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 mb-4">
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
									{createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
									Crear Proveedor
								</button>
							</div>
						</form>
					</div>
				</div>
			)}

			{/* Edit Dialog */}
			{editDialogOpen && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setEditDialogOpen(false)}>
					<div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-8" onClick={(e) => e.stopPropagation()}>
						<div className="mb-6">
							<h2 className="text-xl font-semibold text-slate-900">Editar proveedor</h2>
							<p className="text-sm text-slate-600">Modifica la información del proveedor.</p>
						</div>

						{updateMutation.isError && (
							<div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 mb-4">
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
									{updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
									Guardar Cambios
								</button>
							</div>
						</form>
					</div>
				</div>
			)}

			{/* Export Dialog */}
			{exportDialogOpen && (
				<div
					className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
					onClick={() => {
						setExportDialogOpen(false)
						setExportStatus("idle")
						setExportError(null)
					}}
				>
					<div
						className="w-full max-w-md rounded-2xl bg-white p-6"
						onClick={(e) => e.stopPropagation()}
					>
						<div className="mb-4">
							<h2 className="text-xl font-semibold text-slate-900">Exportar proveedores</h2>
							<p className="text-sm text-slate-600">Elige el alcance y el formato del archivo.</p>
						</div>

						{exportError && (
							<div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
								{exportError}
							</div>
						)}

						<div className="space-y-4">
							<div>
								<label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Alcance</label>
								<select
									value={exportScope}
									onChange={(e) => setExportScope(e.target.value as ExportScope)}
									className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"
								>
									<option value="page">Página actual</option>
									<option value="filtered">Filtrado</option>
									<option value="all">Todos</option>
								</select>
							</div>

							<div>
								<label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Formato</label>
								<select
									value={exportFormat}
									onChange={(e) => setExportFormat(e.target.value as ExportFormat)}
									className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"
								>
									<option value="xlsx">Excel (.xlsx)</option>
									<option value="csv">CSV (.csv)</option>
									<option value="pdf">PDF (.pdf)</option>
								</select>
							</div>
						</div>

						<div className="mt-6 flex justify-end gap-3">
							<button
								type="button"
								onClick={() => {
									setExportDialogOpen(false)
									setExportStatus("idle")
									setExportError(null)
								}}
								className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
							>
								Cancelar
							</button>
							<button
								type="button"
								disabled={exportStatus === "exporting"}
								onClick={async () => {
									const ok = await runExport()
									if (ok) {
										setExportDialogOpen(false)
										setExportStatus("idle")
										setExportError(null)
									}
								}}
								className="inline-flex items-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
							>
								{exportStatus === "exporting" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
								Exportar
							</button>
						</div>
					</div>
				</div>
			)}

		</div>
	)
}

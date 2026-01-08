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
	Mail,
	MapPin,
	Pencil,
	Phone,
	Plus,
	ShieldAlert,
	Trash2,
} from "lucide-react"

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../components/ui/dialog"
import { api } from "../../lib/apiClient"
import { useAuthUser } from "../../lib/hooks/useAuthUser"
import { useDebouncedValue } from "../../lib/hooks/useDebouncedValue"
import { detectEcuadorIdType, formatEcuadorIdTypeLabel, validateEcuadorId } from "./ecuadorId"

import type { ProveedoresFilters } from "./proveedor.types"
import type { ProveedorPayload, ProveedorRecord } from "./proveedor.types"
import { proveedorClient } from "./proveedor.client"
import { matchesProveedorSearch } from "./proveedor.utils"
import { proveedoresQueryKey, useProveedoresQuery } from "./useProveedoresQuery"
import { exportToCSV, exportToXLSX, exportToPDF, type ExportRow } from "./exportProveedores"

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
const DEFAULT_PAGE_SIZE: PageSizeOption = 10

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
		return error.response?.data?.error ?? error.response?.data?.message ?? fallback
	}
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

	const [exportScope, setExportScope] = useState<"page" | "filtered" | "all">("filtered")
	const [exportFormat, setExportFormat] = useState<"csv" | "xlsx" | "pdf">("xlsx")
	const [exportStatus, setExportStatus] = useState<"idle" | "exporting" | "done">("idle")
	const [exportError, setExportError] = useState<string | null>(null)

	const [selectedProveedor, setSelectedProveedor] = useState<ProveedorRecord | null>(null)
	const [editingProveedor, setEditingProveedor] = useState<ProveedorRecord | null>(null)

	const debouncedSearch = useDebouncedValue(searchInput, 300)

	const proveedoresQuery = useProveedoresQuery(isAdmin)
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

	const dateFilterRange = useMemo(() => {
		const start = filters.fechaDesde ? new Date(`${filters.fechaDesde}T00:00:00`).getTime() : null
		const end = filters.fechaHasta ? new Date(`${filters.fechaHasta}T23:59:59.999`).getTime() : null
		return {
			start: start !== null && !Number.isNaN(start) ? start : null,
			end: end !== null && !Number.isNaN(end) ? end : null,
		}
	}, [filters.fechaDesde, filters.fechaHasta])

	const filteredProveedores = useMemo(() => {
		if (!proveedoresQuery.data) return []

		let result = proveedoresQuery.data.filter((proveedor) => matchesProveedorSearch(proveedor, debouncedSearch))

		// Estado
		if (filters.estado !== "all") {
			result = result.filter((proveedor) => {
				const isActive = (proveedor.id_estado ?? 1) === 1
				return filters.estado === "active" ? isActive : !isActive
			})
		}

		// Tipo de identificación
		if (filters.tipoId !== "all") {
			result = result.filter((proveedor) => {
				const type = detectEcuadorIdType(proveedor.ruc_cedula)
				if (filters.tipoId === "ruc") return type === "ruc_natural"
				return type === "cedula"
			})
		}

		// Fecha registro
		if (dateFilterRange.start !== null || dateFilterRange.end !== null) {
			result = result.filter((proveedor) => {
				const ms = new Date(proveedor.fecha_registro).getTime()
				if (Number.isNaN(ms)) return false
				if (dateFilterRange.start !== null && ms < dateFilterRange.start) return false
				if (dateFilterRange.end !== null && ms > dateFilterRange.end) return false
				return true
			})
		}

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
	}, [proveedoresQuery.data, debouncedSearch, filters, dateFilterRange])

	const paginatedProveedores = useMemo(() => {
		const start = (currentPage - 1) * pageSize
		const end = start + pageSize
		return filteredProveedores.slice(start, end)
	}, [filteredProveedores, currentPage, pageSize])

	const totalPages = Math.ceil(filteredProveedores.length / pageSize)

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
			queryFn: async () => {
				const { data } = await api.get<ProveedorRecord[]>("/proveedor")
				return Array.isArray(data) ? data : []
			}
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
		} catch {
			setExportError("No se pudo exportar")
			setExportStatus("idle")
			return false
		}
	}

	const startItem = filteredProveedores.length === 0 ? 0 : (currentPage - 1) * pageSize + 1
	const endItem = filteredProveedores.length === 0 ? 0 : Math.min(currentPage * pageSize, filteredProveedores.length)

	const kpiTotal = useMemo(() => proveedores.length, [proveedores.length])
	const kpiActivos = useMemo(() => proveedores.filter((p) => (p.id_estado ?? 1) === 1).length, [proveedores])
	const kpiInactivos = useMemo(() => proveedores.filter((p) => (p.id_estado ?? 1) !== 1).length, [proveedores])
	const kpiNuevosMes = useMemo(() => {
		const now = new Date()
		return proveedores.filter((p) => {
			const reg = new Date(p.fecha_registro)
			if (Number.isNaN(reg.getTime())) return false
			return reg.getMonth() === now.getMonth() && reg.getFullYear() === now.getFullYear()
		}).length
	}, [proveedores])

	const openFilters = () => {
		setFiltersDraft(filters)
		setFiltersDrawerOpen(true)
	}

	const clearAllFilters = () => {
		setFilters(defaultFilters)
		setSearchInput("")
	}

	if (!isAdmin) {
		return (
			<div className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
				<div className="flex items-center gap-3 text-amber-800">
					<ShieldAlert className="h-5 w-5" />
					<div>
						<p className="font-semibold">Acceso restringido</p>
						<p className="text-sm">Solo usuarios con rol ADMIN pueden gestionar proveedores.</p>
					</div>
				</div>
			</div>
		)
	}

	return (
		<div className="space-y-6">
			<section
				aria-labelledby="proveedores-encabezado"
				className="rounded-3xl border border-slate-200 bg-gradient-to-b from-white to-slate-50 p-6 shadow-sm"
			>
				<div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
					<div>
						<p id="proveedores-encabezado" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
							GESTIÓN
						</p>
						<h1 className="mt-1 text-3xl font-semibold text-slate-900">Proveedores</h1>
						<p className="mt-1 text-sm text-slate-500">Centraliza datos legales y de contacto para compras.</p>
					</div>
					<div className="flex flex-col items-center gap-2 self-end text-center">
						<p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Acciones rápidas</p>
						<button
							type="button"
							onClick={() => setCreateDialogOpen(true)}
							className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
							aria-label="Nuevo proveedor"
						>
							<Plus className="h-4 w-4" aria-hidden="true" />
							Nuevo proveedor
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
				<div className="grid grid-cols-1 gap-4 md:grid-cols-4">
					<article
						role="button"
						tabIndex={0}
						onClick={() => {
							setFilters(defaultFilters)
							setSearchInput("")
						}}
						onKeyDown={(event) => {
							if (event.key === "Enter" || event.key === " ") {
								event.preventDefault()
								setFilters(defaultFilters)
								setSearchInput("")
							}
						}}
						className="cursor-pointer rounded-2xl border border-slate-200 bg-white p-5 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
					>
						<p className="text-xs uppercase text-slate-500">Total proveedores</p>
						<p className="mt-2 text-3xl font-semibold text-slate-900">{kpiTotal}</p>
						<p className="text-sm text-slate-500">Registrados en el sistema</p>
					</article>
					<article
						role="button"
						tabIndex={0}
						onClick={() => setFilters((prev) => ({ ...prev, estado: "active" }))}
						onKeyDown={(event) => {
							if (event.key === "Enter" || event.key === " ") {
								event.preventDefault()
								setFilters((prev) => ({ ...prev, estado: "active" }))
							}
						}}
						className="cursor-pointer rounded-2xl border border-slate-200 bg-white p-5 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
					>
						<p className="text-xs uppercase text-slate-500">Proveedores activos</p>
						<p className="mt-2 text-3xl font-semibold text-emerald-700">{kpiActivos}</p>
						<p className="text-sm text-slate-500">Disponibles para compras</p>
					</article>
					<article
						role="button"
						tabIndex={0}
						onClick={() => setFilters((prev) => ({ ...prev, estado: "inactive" }))}
						onKeyDown={(event) => {
							if (event.key === "Enter" || event.key === " ") {
								event.preventDefault()
								setFilters((prev) => ({ ...prev, estado: "inactive" }))
							}
						}}
						className="cursor-pointer rounded-2xl border border-slate-200 bg-white p-5 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
					>
						<p className="text-xs uppercase text-slate-500">Proveedores inactivos</p>
						<p className="mt-2 text-3xl font-semibold text-slate-900">{kpiInactivos}</p>
						<p className="text-sm text-slate-500">Sin disponibilidad</p>
					</article>
					<article
						role="button"
						tabIndex={0}
						onClick={() => {
							const now = new Date()
							const first = new Date(now.getFullYear(), now.getMonth(), 1)
							const last = new Date(now.getFullYear(), now.getMonth() + 1, 0)
							const pad2 = (n: number) => String(n).padStart(2, "0")
							const toYmd = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
							setFilters((prev) => ({ ...prev, fechaDesde: toYmd(first), fechaHasta: toYmd(last) }))
						}}
						onKeyDown={(event) => {
							if (event.key === "Enter" || event.key === " ") {
								event.preventDefault()
								const now = new Date()
								const first = new Date(now.getFullYear(), now.getMonth(), 1)
								const last = new Date(now.getFullYear(), now.getMonth() + 1, 0)
								const pad2 = (n: number) => String(n).padStart(2, "0")
								const toYmd = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
								setFilters((prev) => ({ ...prev, fechaDesde: toYmd(first), fechaHasta: toYmd(last) }))
							}
						}}
						className="cursor-pointer rounded-2xl border border-slate-200 bg-white p-5 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
					>
						<p className="text-xs uppercase text-slate-500">Nuevos este mes</p>
						<p className="mt-2 text-3xl font-semibold text-slate-900">{kpiNuevosMes}</p>
						<p className="text-sm text-slate-500">Registrados recientemente</p>
					</article>
				</div>
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
					onOpenFilters={openFilters}
					onOpenExport={() => setExportDialogOpen(true)}
					filterChips={filterChips}
					onRemoveChip={(key) => {
						if (key === "estado") setFilters((prev) => ({ ...prev, estado: defaultFilters.estado }))
						if (key === "tipoId") setFilters((prev) => ({ ...prev, tipoId: defaultFilters.tipoId }))
						if (key === "fecha") setFilters((prev) => ({ ...prev, fechaDesde: "", fechaHasta: "" }))
						if (key === "orden") setFilters((prev) => ({ ...prev, orden: defaultFilters.orden }))
					}}
					onClearAllFilters={clearAllFilters}
				/>

				<div className="overflow-x-auto">
					<table className="min-w-full divide-y divide-slate-200">
						<thead className="bg-slate-50">
							<tr>
								<th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
									Proveedor
								</th>
								<th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
									Identificación
								</th>
								<th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
									Contacto
								</th>
								<th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
									Fecha Registro
								</th>
								<th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
									Estado
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
										<p className="text-sm font-semibold text-slate-900">{proveedor.nombre_proveedor}</p>
										<p className="text-xs text-slate-500">ID: {proveedor.id_proveedor}</p>
									</td>
									<td className="px-6 py-4">
										<p className="text-sm font-semibold text-slate-900">{proveedor.ruc_cedula}</p>
										<p className="text-xs text-slate-500">
											{formatEcuadorIdTypeLabel(detectEcuadorIdType(proveedor.ruc_cedula))}
										</p>
									</td>
									<td className="px-6 py-4">
										<div className="space-y-1">
											{proveedor.correo && (
												<div className="flex items-center gap-2 text-sm text-slate-600">
													<Mail className="h-4 w-4 text-slate-400" aria-hidden="true" />
													{proveedor.correo}
												</div>
											)}
											{proveedor.telefono && (
												<div className="flex items-center gap-2 text-sm text-slate-600">
													<Phone className="h-4 w-4 text-slate-400" aria-hidden="true" />
													{proveedor.telefono}
												</div>
											)}
											{proveedor.direccion && (
												<div className="flex items-center gap-2 text-sm text-slate-600">
													<MapPin className="h-4 w-4 text-slate-400" aria-hidden="true" />
													{proveedor.direccion}
												</div>
											)}
										</div>
									</td>
									<td className="px-6 py-4 text-sm text-slate-600">
										{dateFormatter.format(new Date(proveedor.fecha_registro))}
									</td>
									<td className="px-6 py-4">
										{(() => {
											const isActive = (proveedor.id_estado ?? 1) === 1
											return (
												<span
													className={
														"inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold " +
														(isActive ? "bg-emerald-50 text-emerald-700" : "bg-red-100 text-red-700")
													}
												>
													{isActive ? "Activo" : "Inactivo"}
												</span>
											)
										})()}
									</td>
									<td className="px-6 py-4 text-right">
										<div className="flex items-center justify-end gap-2">
											<button
												onClick={() => handleOpenDetail(proveedor)}
												className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
												aria-label={`Ver proveedor ${proveedor.nombre_proveedor}`}
												title="Ver"
											>
												<Eye className="h-4 w-4" />
											</button>
											<button
												onClick={() => handleOpenEdit(proveedor)}
												className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
												aria-label={`Editar proveedor ${proveedor.nombre_proveedor}`}
												title="Editar"
											>
												<Pencil className="h-4 w-4" />
											</button>
											<button
												onClick={() => handleDelete(proveedor)}
												className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-red-200 bg-white text-red-600 transition hover:bg-red-50 hover:text-red-700"
												aria-label={`Eliminar proveedor ${proveedor.nombre_proveedor}`}
												title="Eliminar"
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
						<p>No hay proveedores registrados.</p>
					</div>
				)}

				{!proveedoresQuery.isLoading && paginatedProveedores.length === 0 && filteredProveedores.length > 0 && (
					<div className="p-8 text-center text-slate-500">
						<Building2 size={36} className="mx-auto mb-2 opacity-50" />
						<p>No se encontraron proveedores con los filtros aplicados.</p>
					</div>
				)}

				{/* Footer: Paginación + Por página */}
				<div className="border-t border-slate-200 bg-white px-6 py-4">
					<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
						<p className="text-xs text-slate-500">
							Página {currentPage} de {Math.max(1, totalPages)}
						</p>

						<div className="flex items-center justify-between gap-3 sm:flex-1 sm:justify-center">
							<button
								type="button"
								onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
								disabled={currentPage <= 1}
								className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
							>
								Anterior
							</button>
							<span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-900">
								{currentPage}
							</span>
							<button
								type="button"
								onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
								disabled={currentPage >= totalPages || totalPages <= 1}
								className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
							>
								Siguiente
							</button>
						</div>

						<div className="flex items-center justify-end gap-2">
							<label htmlFor="proveedores-page-size" className="text-xs font-semibold text-slate-600">
								Por página
							</label>
							<select
								id="proveedores-page-size"
								value={String(pageSize)}
								onChange={(event) => {
									setPageSize(Number(event.target.value) as PageSizeOption)
									setCurrentPage(1)
								}}
								className="h-9 rounded-xl border border-slate-200 bg-white px-2 text-sm font-semibold text-slate-700 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
							>
								<option value="10">10</option>
								<option value="20">20</option>
								<option value="30">30</option>
								<option value="40">40</option>
							</select>
						</div>
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
			<Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
				<DialogContent className="max-w-3xl" disableOutsideClose hideCloseButton>
					<DialogHeader>
						<DialogTitle>Exportar proveedores</DialogTitle>
						<DialogDescription>Selecciona el alcance y el formato de exportación.</DialogDescription>
					</DialogHeader>

					<div className="grid gap-6 md:grid-cols-2">
						<div className="grid gap-3">
							<p className="text-sm font-semibold text-slate-900">Alcance</p>
							<div className="grid gap-2">
								<label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-slate-900 hover:bg-slate-50">
									<input
										type="radio"
										name="export-scope"
										checked={exportScope === "page"}
										onChange={() => setExportScope("page")}
										className="mt-1"
									/>
									<div>
										<p className="text-sm font-semibold text-slate-900">Página actual</p>
										<p className="text-xs text-slate-500">Lo visible en pantalla según la paginación actual.</p>
									</div>
								</label>
								<label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-slate-900 hover:bg-slate-50">
									<input
										type="radio"
										name="export-scope"
										checked={exportScope === "filtered"}
										onChange={() => setExportScope("filtered")}
										className="mt-1"
									/>
									<div>
										<p className="text-sm font-semibold text-slate-900">Filtradas</p>
										<p className="text-xs text-slate-500">Aplica búsqueda + filtros + orden, sin importar página.</p>
									</div>
								</label>
								<label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-slate-900 hover:bg-slate-50">
									<input
										type="radio"
										name="export-scope"
										checked={exportScope === "all"}
										onChange={() => setExportScope("all")}
										className="mt-1"
									/>
									<div>
										<p className="text-sm font-semibold text-slate-900">Todo</p>
										<p className="text-xs text-slate-500">Ignora filtros y exporta todos los proveedores.</p>
									</div>
								</label>
							</div>
						</div>

						<div className="grid gap-3">
							<p className="text-sm font-semibold text-slate-900">Formato</p>
							<div className="grid gap-2">
								<label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-slate-900 hover:bg-slate-50">
									<input
										type="radio"
										name="export-format"
										checked={exportFormat === "csv"}
										onChange={() => setExportFormat("csv")}
										className="mt-1"
									/>
									<div>
										<p className="text-sm font-semibold text-slate-900">CSV</p>
										<p className="text-xs text-slate-500">Compatible con Excel (separador ;).</p>
									</div>
								</label>
								<label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-slate-900 hover:bg-slate-50">
									<input
										type="radio"
										name="export-format"
										checked={exportFormat === "xlsx"}
										onChange={() => setExportFormat("xlsx")}
										className="mt-1"
									/>
									<div>
										<p className="text-sm font-semibold text-slate-900">Excel (.xlsx)</p>
										<p className="text-xs text-slate-500">Hoja "Proveedores" con columnas formateadas.</p>
									</div>
								</label>
								<label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-slate-900 hover:bg-slate-50">
									<input
										type="radio"
										name="export-format"
										checked={exportFormat === "pdf"}
										onChange={() => setExportFormat("pdf")}
										className="mt-1"
									/>
									<div>
										<p className="text-sm font-semibold text-slate-900">PDF</p>
										<p className="text-xs text-slate-500">Tabla en PDF (landscape).</p>
									</div>
								</label>
							</div>
						</div>
					</div>

					{exportError && (
						<div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{exportError}</div>
					)}

					<DialogFooter>
						<button
							type="button"
							onClick={() => {
								if (exportStatus === "exporting") return
								setExportDialogOpen(false)
							}}
							disabled={exportStatus === "exporting"}
							className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
						>
							Cancelar
						</button>
						<button
							type="button"
							onClick={async () => {
								const ok = await runExport()
								if (ok) setExportDialogOpen(false)
							}}
							disabled={exportStatus === "exporting"}
							className="inline-flex items-center justify-center rounded-2xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
						>
							{exportStatus === "exporting" ? "Exportando…" : exportStatus === "done" ? "Listo" : "Aceptar"}
						</button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	)
}

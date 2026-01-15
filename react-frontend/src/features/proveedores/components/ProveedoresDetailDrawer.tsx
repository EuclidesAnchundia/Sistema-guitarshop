import { Download, Mail, MapPin, Phone } from "lucide-react"

import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "../../../components/ui/drawer"
import type { ProveedorRecord } from "../proveedor.types"

type Props = {
	open: boolean
	onOpenChange: (open: boolean) => void

	proveedor: ProveedorRecord | null

	dateFormatter: Intl.DateTimeFormat

	onEdit: () => void
	onExportPdf: () => void
	exportingPdf?: boolean
	exportDisabled?: boolean
	onClose: () => void
}

export function ProveedoresDetailDrawer(props: Props) {
	const detailProveedor = props.proveedor

	if (!detailProveedor) return null

	const isActive = (detailProveedor.id_estado ?? 1) === 1
	const statusClass = isActive ? "bg-emerald-50 text-emerald-700" : "bg-red-100 text-red-700"

	return (
		<Drawer open={props.open} onOpenChange={props.onOpenChange}>
			<DrawerContent className="overflow-hidden">
				<div className="flex h-dvh flex-col">
					<DrawerHeader>
						<DrawerTitle className="pr-10">{detailProveedor.nombre_proveedor}</DrawerTitle>
						<DrawerDescription className="mt-1 flex flex-col gap-3">
							<div className="flex flex-wrap items-center gap-2">
								<span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
									{detailProveedor.ruc_cedula}
								</span>
								<span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClass}`}>
									{isActive ? "Activo" : "Inactivo"}
								</span>
							</div>
							<p className="text-sm text-slate-500">Información legal, contacto y estado.</p>
						</DrawerDescription>

						<div className="mt-4 flex flex-wrap items-center gap-2">
							<button
								type="button"
								onClick={props.onExportPdf}
								disabled={Boolean(props.exportDisabled || props.exportingPdf)}
								className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
							>
								<Download className="h-4 w-4" aria-hidden="true" />
								Exportar PDF
							</button>
							<button
								type="button"
								onClick={props.onEdit}
								className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
							>
								Editar
							</button>
							<button
								type="button"
								onClick={props.onClose}
								className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
							>
								Cerrar
							</button>
						</div>
					</DrawerHeader>

					<div className="flex-1 space-y-6 overflow-y-auto overflow-x-hidden px-6 py-5">
						<div className="rounded-2xl border border-slate-200 p-4">
							<p className="text-sm font-semibold text-slate-700">Información legal</p>
							<div className="mt-4 grid gap-4 sm:grid-cols-2">
								<div>
									<p className="text-xs font-semibold uppercase tracking-wide text-slate-500">RUC / Cédula</p>
									<p className="mt-1 text-sm font-semibold text-slate-900">{detailProveedor.ruc_cedula}</p>
								</div>
								<div>
									<p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Fecha de registro</p>
									<p className="mt-1 text-sm font-semibold text-slate-900">
										{props.dateFormatter.format(new Date(detailProveedor.fecha_registro))}
									</p>
								</div>
							</div>
						</div>

						<div className="rounded-2xl border border-slate-200 p-4">
							<p className="text-sm font-semibold text-slate-700">Información de contacto</p>
							<div className="mt-4 space-y-3 text-sm text-slate-700">
								<div className="flex items-start gap-2">
									<Mail className="mt-0.5 h-4 w-4 text-slate-400" aria-hidden="true" />
									<div>
										<p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Correo</p>
										<p className="font-semibold text-slate-900">{detailProveedor.correo?.trim() ? detailProveedor.correo : "—"}</p>
									</div>
								</div>
								<div className="flex items-start gap-2">
									<Phone className="mt-0.5 h-4 w-4 text-slate-400" aria-hidden="true" />
									<div>
										<p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Teléfono</p>
										<p className="font-semibold text-slate-900">{detailProveedor.telefono?.trim() ? detailProveedor.telefono : "—"}</p>
									</div>
								</div>
								<div className="flex items-start gap-2">
									<MapPin className="mt-0.5 h-4 w-4 text-slate-400" aria-hidden="true" />
									<div>
										<p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Dirección</p>
										<p className="font-semibold text-slate-900">{detailProveedor.direccion?.trim() ? detailProveedor.direccion : "—"}</p>
									</div>
								</div>
							</div>
						</div>

						<div className="rounded-2xl border border-slate-200 p-4">
							<p className="text-sm font-semibold text-slate-700">Estado</p>
							<div className="mt-4 flex flex-wrap items-center justify-between gap-3">
								<div>
									<p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Registro</p>
									<p className="mt-1 text-sm text-slate-700">{isActive ? "Disponible para compras" : "No disponible"}</p>
								</div>
								<span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass}`}>
									{isActive ? "Activo" : "Inactivo"}
								</span>
							</div>
							<p className="mt-2 text-xs text-slate-500">Estructura lista para métricas futuras (compras y productos asociados).</p>
						</div>
					</div>
				</div>
			</DrawerContent>
		</Drawer>
	)
}
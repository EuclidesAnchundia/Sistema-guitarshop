import { Download } from "lucide-react"

import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "../../../components/ui/drawer"
import type { ClienteRecord } from "../cliente.types"
import { getClienteFullName } from "../cliente.utils"

type Props = {
	open: boolean
	onOpenChange: (open: boolean) => void

	cliente: ClienteRecord | null

	dateFormatter: Intl.DateTimeFormat

	onEdit: () => void
	onExportPdf: () => void
	exportingPdf?: boolean
	exportDisabled?: boolean
	onClose: () => void
}

export function ClientesDetailDrawer(props: Props) {
	const detailCliente = props.cliente

	if (!detailCliente) return null

	return (
		<Drawer open={props.open} onOpenChange={props.onOpenChange}>
			<DrawerContent className="max-h-[85vh]">
				<DrawerHeader>
					<DrawerTitle>{getClienteFullName(detailCliente)}</DrawerTitle>
					<DrawerDescription>
						Detalles del cliente y su información de contacto.
					</DrawerDescription>
				</DrawerHeader>

				<div className="flex flex-col gap-6 p-6">
					<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
						<div>
							<label className="text-sm font-medium text-slate-500">Nombres</label>
							<p className="mt-1 text-sm text-slate-900">{detailCliente.nombres}</p>
						</div>
						<div>
							<label className="text-sm font-medium text-slate-500">Apellidos</label>
							<p className="mt-1 text-sm text-slate-900">{detailCliente.apellidos}</p>
						</div>
						<div>
							<label className="text-sm font-medium text-slate-500">Cédula</label>
							<p className="mt-1 text-sm text-slate-900">{detailCliente.cedula}</p>
						</div>
						<div>
							<label className="text-sm font-medium text-slate-500">Fecha de Registro</label>
							<p className="mt-1 text-sm text-slate-900">
								{props.dateFormatter.format(new Date(detailCliente.fecha_registro))}
							</p>
						</div>
						<div className="sm:col-span-2">
							<label className="text-sm font-medium text-slate-500">Correo</label>
							<p className="mt-1 text-sm text-slate-900">
								{detailCliente.correo || <span className="text-slate-500">No especificado</span>}
							</p>
						</div>
						<div>
							<label className="text-sm font-medium text-slate-500">Teléfono</label>
							<p className="mt-1 text-sm text-slate-900">
								{detailCliente.telefono || <span className="text-slate-500">No especificado</span>}
							</p>
						</div>
						<div>
							<label className="text-sm font-medium text-slate-500">Dirección</label>
							<p className="mt-1 text-sm text-slate-900">
								{detailCliente.direccion || <span className="text-slate-500">No especificada</span>}
							</p>
						</div>
					</div>

					<div className="flex justify-end gap-3">
						<button
							onClick={props.onExportPdf}
							disabled={Boolean(props.exportDisabled || props.exportingPdf)}
							className="inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap rounded-md border border-slate-200 bg-white px-3 py-1 text-sm font-medium shadow-sm transition-colors hover:bg-slate-50 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-950"
						>
							<Download className="h-4 w-4" aria-hidden="true" />
							Exportar PDF
						</button>
						<button
							onClick={props.onClose}
							className="inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap rounded-md border border-slate-200 bg-white px-3 py-1 text-sm font-medium shadow-sm transition-colors hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-950"
						>
							Cerrar
						</button>
						<button
							onClick={props.onEdit}
							className="inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap rounded-md bg-slate-900 px-3 py-1 text-sm font-medium text-white shadow transition-colors hover:bg-slate-900/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-950"
						>
							<svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
							</svg>
							Editar
						</button>
					</div>
				</div>
			</DrawerContent>
		</Drawer>
	)
}
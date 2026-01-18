import { Calendar, Download, IdCard, Mail, MapPin, Phone } from "lucide-react"

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
	const fullName = detailCliente ? getClienteFullName(detailCliente) : ""
	const initials = detailCliente
		? `${(detailCliente.nombres ?? "").trim().slice(0, 1)}${(detailCliente.apellidos ?? "").trim().slice(0, 1)}`
			.toUpperCase()
			|| "CL"
		: "CL"

	return (
		<Drawer open={props.open} onOpenChange={props.onOpenChange}>
			<DrawerContent className="overflow-hidden">
				<div className="flex h-dvh flex-col">
					<DrawerHeader>
						<DrawerTitle className="pr-10">
							{detailCliente ? fullName : "Detalle de cliente"}
						</DrawerTitle>
						<DrawerDescription>Detalles del cliente y su información de contacto.</DrawerDescription>

						<div className="mt-4 flex flex-wrap items-center gap-2">
							<button
								type="button"
								onClick={props.onExportPdf}
								disabled={!detailCliente || Boolean(props.exportDisabled || props.exportingPdf)}
								className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
							>
								<Download className="h-4 w-4" aria-hidden="true" />
								Exportar PDF
							</button>
							<button
								type="button"
								onClick={props.onEdit}
								disabled={!detailCliente}
								className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
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

					<div className="flex-1 overflow-y-auto overflow-x-hidden px-6 py-5">
						{!detailCliente ? (
							<div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
								Selecciona un cliente para ver el detalle.
							</div>
						) : (
							<div className="space-y-5">
								<div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
									<div className="flex flex-wrap items-start justify-between gap-3">
										<div className="flex items-start gap-3">
											<div className="grid h-11 w-11 place-items-center rounded-2xl bg-slate-900 text-sm font-semibold text-white">
												{initials}
											</div>
											<div>
												<p className="text-base font-semibold text-slate-900">{fullName}</p>
												<div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
													<span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 ring-1 ring-slate-200">
														<IdCard className="h-3.5 w-3.5" />
														{detailCliente.cedula}
													</span>
													<span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 ring-1 ring-slate-200">
														<Calendar className="h-3.5 w-3.5" />
														Registrado: {props.dateFormatter.format(new Date(detailCliente.fecha_registro))}
													</span>
												</div>
											</div>
										</div>
									</div>
								</div>

								<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
									<div className="rounded-2xl border border-slate-200 bg-white p-4">
										<p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Contacto</p>
										<div className="mt-3 space-y-3 text-sm">
											<div className="flex items-start gap-2">
												<Mail className="mt-0.5 h-4 w-4 text-slate-400" />
												<div>
													<p className="font-semibold text-slate-900">Correo</p>
													<p className="text-slate-600">{detailCliente.correo?.trim() ? detailCliente.correo : "No especificado"}</p>
												</div>
											</div>
											<div className="flex items-start gap-2">
												<Phone className="mt-0.5 h-4 w-4 text-slate-400" />
												<div>
													<p className="font-semibold text-slate-900">Teléfono</p>
													<p className="text-slate-600">{detailCliente.telefono?.trim() ? detailCliente.telefono : "No especificado"}</p>
												</div>
											</div>
										</div>
									</div>

									<div className="rounded-2xl border border-slate-200 bg-white p-4">
										<p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Dirección</p>
										<div className="mt-3 flex items-start gap-2 text-sm">
											<MapPin className="mt-0.5 h-4 w-4 text-slate-400" />
											<p className="text-slate-600">{detailCliente.direccion?.trim() ? detailCliente.direccion : "No especificada"}</p>
										</div>
									</div>
								</div>
							</div>
						)}
					</div>
				</div>
			</DrawerContent>
		</Drawer>
	)
}
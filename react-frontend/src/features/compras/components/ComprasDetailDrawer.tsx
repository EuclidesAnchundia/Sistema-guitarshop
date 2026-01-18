"use client"

import { Download, Loader2, NotebookPen, Trash2 } from "lucide-react"

import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "../../../components/ui/drawer"
import type { CompraDetailRecord, ProductoCompraItem } from "../compra.types"

type Props = {
	open: boolean
	onOpenChange: (open: boolean) => void

	compra: CompraDetailRecord | null
	isLoading: boolean
	isError: boolean

	dateFormatter: Intl.DateTimeFormat
	currency: Intl.NumberFormat

	onEdit: () => void
	onDelete: () => void
	onClose: () => void

	onExportPdf?: () => void
	exportingPdf?: boolean
	busy?: boolean
	errorMessage?: string | null
}

export function ComprasDetailDrawer(props: Props) {
	const compra = props.compra

	return (
		<Drawer open={props.open} onOpenChange={props.onOpenChange}>
			<DrawerContent className="overflow-hidden">
				<div className="flex h-dvh flex-col">
					<DrawerHeader>
						<DrawerTitle className="pr-10">Detalle de compra</DrawerTitle>
						<DrawerDescription>Cabecera, productos y totales.</DrawerDescription>

						<div className="mt-4 flex flex-wrap items-center gap-2">
							{props.onExportPdf && (
								<button
									type="button"
									onClick={props.onExportPdf}
									disabled={!compra || props.exportingPdf}
									className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
								>
									{props.exportingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
									Exportar PDF
								</button>
							)}

							<button
								type="button"
								onClick={props.onEdit}
								disabled={!compra || props.busy}
								className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
							>
								<NotebookPen className="h-4 w-4" />
								Editar
							</button>

							<button
								type="button"
								onClick={props.onDelete}
								disabled={!compra || props.busy}
								className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
							>
								<Trash2 className="h-4 w-4" />
								Eliminar
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
						{props.isLoading && (
							<div className="flex items-center gap-2 text-slate-500">
								<Loader2 className="h-4 w-4 animate-spin" />
								Cargando detalle...
							</div>
						)}

						{props.isError && !props.isLoading && (
							<div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
								No se pudo cargar el detalle.
							</div>
						)}

						{compra && (
							<>
								<div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
									<div className="flex flex-wrap items-start justify-between gap-2">
										<div>
											<p className="text-base font-semibold text-slate-900">Compra #{compra.id_compra}</p>
											<p className="text-xs text-slate-500">{props.dateFormatter.format(new Date(compra.fecha_compra))}</p>
										</div>
										<div className="text-right">
											<p className="text-xs text-slate-500">Proveedor</p>
											<p className="text-sm font-semibold text-slate-900">{compra.proveedor?.nombre_proveedor ?? "—"}</p>
										</div>
									</div>

									<div className="mt-3 grid gap-1">
										<p className="text-xs text-slate-500">Registrada por: {compra.usuario?.nombre_completo ?? "—"}</p>
										{compra.observacion?.trim() ? (
											<p className="text-xs text-slate-500">Obs: {compra.observacion}</p>
										) : (
											<p className="text-xs text-slate-500">Obs: —</p>
										)}
									</div>
								</div>

								<div className="rounded-2xl border border-slate-200 bg-white">
									<div className="overflow-x-auto">
										<table className="min-w-full divide-y divide-slate-200 text-sm">
											<thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
												<tr>
													<th className="px-4 py-3 text-left">Producto</th>
													<th className="px-4 py-3 text-left">Cantidad</th>
													<th className="px-4 py-3 text-left">Costo</th>
													<th className="px-4 py-3 text-left">Subtotal</th>
												</tr>
											</thead>
											<tbody className="divide-y divide-slate-200">
												{(compra.producto_compra ?? []).length === 0 ? (
													<tr>
														<td className="px-4 py-4 text-slate-500" colSpan={4}>
															Sin detalle.
														</td>
													</tr>
												) : (
													compra.producto_compra.map((item: ProductoCompraItem) => (
														<tr key={item.id_producto_compra}>
															<td className="px-4 py-3">
																<p className="font-medium text-slate-900">{item.producto?.nombre_producto ?? "—"}</p>
																<p className="text-xs text-slate-500">{item.producto?.codigo_producto ?? "—"}</p>
															</td>
															<td className="px-4 py-3 text-slate-700">{item.cantidad_compra}</td>
															<td className="px-4 py-3 text-slate-700">{props.currency.format(item.costo_unitario)}</td>
															<td className="px-4 py-3 font-semibold text-slate-900">{props.currency.format(item.subtotal)}</td>
														</tr>
													))
												)}
											</tbody>
										</table>
									</div>
								</div>

								<div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
									<div className="flex items-center justify-between">
										<span>Subtotal</span>
										<span>{props.currency.format(compra.subtotal)}</span>
									</div>
									<div className="flex items-center justify-between">
										<span>IVA</span>
										<span>{props.currency.format(compra.impuesto)}</span>
									</div>
									<div className="mt-2 flex items-center justify-between text-base font-semibold text-slate-900">
										<span>Total</span>
										<span>{props.currency.format(compra.total)}</span>
									</div>
								</div>

								{props.errorMessage && (
									<div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">{props.errorMessage}</div>
								)}
							</>
						)}
					</div>
				</div>
			</DrawerContent>
		</Drawer>
	)
}
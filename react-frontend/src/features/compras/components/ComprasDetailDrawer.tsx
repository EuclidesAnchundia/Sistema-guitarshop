"use client"

import { X } from "lucide-react"

import type { CompraDetailRecord, ProductoCompraItem } from "../compra.types"

function formatMoney(value: unknown): string {
	const numeric = typeof value === "number" ? value : Number(value)
	if (!Number.isFinite(numeric)) return "0.00"
	return numeric.toFixed(2)
}

type ComprasDetailDrawerProps = {
	open: boolean
	compra: CompraDetailRecord | null
	dateFormatter: Intl.DateTimeFormat
	onEdit: () => void
	onClose: () => void
}

export function ComprasDetailDrawer({
	open,
	compra,
	dateFormatter,
	onEdit,
	onClose,
}: ComprasDetailDrawerProps) {
	if (!compra) return null

	if (!open) return null

	return (
		<div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={onClose}>
			<div className="w-full max-w-md rounded-t-2xl bg-white p-6" onClick={(e) => e.stopPropagation()}>
				<div className="flex items-center justify-between">
					<div>
						<h2 className="text-lg font-semibold text-slate-900">Compra #{compra.id_compra}</h2>
						<p className="text-sm text-slate-500">
							Detalles de la compra realizada
						</p>
					</div>
					<button
						onClick={onClose}
						className="rounded-xl border border-slate-200 bg-white p-2 text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
					>
						<X className="h-4 w-4" />
					</button>
				</div>

				<div className="mt-6 flex flex-col gap-6">
					<div className="grid grid-cols-2 gap-4">
						<div>
							<label className="text-sm font-medium text-slate-700">Proveedor</label>
							<p className="text-sm text-slate-900">{compra.proveedor?.nombre_proveedor ?? "—"}</p>
						</div>
						<div>
							<label className="text-sm font-medium text-slate-700">Fecha de Compra</label>
							<p className="text-sm text-slate-900">{dateFormatter.format(new Date(compra.fecha_compra))}</p>
						</div>
						<div>
							<label className="text-sm font-medium text-slate-700">Total</label>
							<p className="text-sm text-slate-900">${formatMoney(compra.total)}</p>
						</div>
						<div>
							<label className="text-sm font-medium text-slate-700">Fecha de Registro</label>
							<p className="text-sm text-slate-900">{dateFormatter.format(new Date(compra.fecha_compra))}</p>
						</div>
					</div>

					{compra.producto_compra && compra.producto_compra.length > 0 && (
						<div>
							<label className="text-sm font-medium text-slate-700 mb-3 block">Productos</label>
							<div className="space-y-3">
								{compra.producto_compra.map((detalle: ProductoCompraItem) => (
									<div key={detalle.id_producto_compra} className="rounded-lg border border-slate-200 p-4">
										<div className="flex items-center justify-between">
											<div>
												<p className="font-medium text-slate-900">{detalle.producto.nombre_producto}</p>
												<p className="text-sm text-slate-600">
													Cantidad: {detalle.cantidad_compra} × ${formatMoney(detalle.costo_unitario)}
												</p>
											</div>
											<div className="text-right">
												<p className="font-medium text-slate-900">${formatMoney(detalle.subtotal)}</p>
											</div>
										</div>
									</div>
								))}
							</div>
						</div>
					)}

					<div className="flex gap-3">
						<button
							onClick={onEdit}
							className="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
						>
							Editar Compra
						</button>
						<button
							onClick={onClose}
							className="flex-1 rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
						>
							Cerrar
						</button>
					</div>
				</div>
			</div>
		</div>
	)
}
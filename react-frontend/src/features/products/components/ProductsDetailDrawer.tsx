import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Download, Loader2, X } from "lucide-react"

import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "../../../components/ui/drawer"
import { Dialog, DialogContent, DialogDescription as DialogDesc, DialogHeader as DialogHead, DialogTitle as DialogTit } from "../../../components/ui/dialog"

import type { KardexMovimientoRecord, ProductoRecord, ProductSalesSummary } from "../product.types"
import { productClient } from "../product.client"
import {
	computeMargin,
	productStockStatusLabel,
	resolveProductStockStatus,
} from "../product.utils"

type SalesState = {
	isLoading: boolean
	isError: boolean
	error?: unknown
	data?: ProductSalesSummary
}

type MovementsState = {
	isLoading: boolean
	isError: boolean
	data?: KardexMovimientoRecord[]
}

type Props = {
	open: boolean
	onOpenChange: (open: boolean) => void

	product: ProductoRecord | null
	inferCategoryFromCode: (code: string) => string | null

	currency: Intl.NumberFormat
	dateFormatter: Intl.DateTimeFormat

	sales: SalesState
	onRetrySales: () => void

	movements: MovementsState
	onRetryMovements: () => void

	onEdit: () => void
	onAdjustStock: () => void
	onHistory: () => void
	onExportPdf: () => void
	exportingPdf: boolean
	onClose: () => void
}

export function ProductsDetailDrawer(props: Props) {
	const detailProduct = props.product
	const [historyOpen, setHistoryOpen] = useState(false)

	const stockStatus = detailProduct ? resolveProductStockStatus(detailProduct) : null


	const stockStatusClass =
		stockStatus === "SIN_STOCK"
			? "bg-slate-100 text-slate-700"
			: stockStatus === "CRITICAL"
				? "bg-red-50 text-red-700"
				: stockStatus === "LOW"
					? "bg-amber-50 text-amber-700"
					: "bg-emerald-50 text-emerald-700"

	const buildMovementType = (m: KardexMovimientoRecord): "VENTA" | "AJUSTE" => {
		const raw = `${m.tipo_movimiento ?? ""} ${m.origen ?? ""}`.toUpperCase()
		if (raw.includes("VENTA") || raw.includes("FACTURA")) return "VENTA"
		return "AJUSTE"
	}

	const getMovementReference = (m: KardexMovimientoRecord): string => {
		const type = buildMovementType(m)
		if (type === "VENTA") {
			return m.id_referencia ? `Factura #${m.id_referencia}` : "Factura"
		}
		return m.comentario?.trim() ? m.comentario : "Ajuste"
	}

	const filteredMovements = useMemo(() => {
		const items = props.movements.data ?? []
		return [...items].sort((a, b) => {
			const dateA = new Date(a.fecha_movimiento ?? 0).getTime()
			const dateB = new Date(b.fecha_movimiento ?? 0).getTime()
			return dateB - dateA
		})
	}, [props.movements.data])

	const visibleMovements = useMemo(() => {
		return filteredMovements.slice(0, 7)
	}, [filteredMovements])

	const fullHistoryQuery = useQuery<KardexMovimientoRecord[]>({
		queryKey: ["kardex", detailProduct?.id_producto ?? null, "full"],
		enabled: Boolean(historyOpen && detailProduct?.id_producto),
		staleTime: 30_000,
		queryFn: async () => {
			if (!detailProduct?.id_producto) return []
			return productClient.listKardexForProduct({ productId: detailProduct.id_producto, limit: null })
		},
	})

	return (
		<Drawer open={props.open} onOpenChange={props.onOpenChange}>
			<DrawerContent className="overflow-hidden">
				{detailProduct && (
					<div className="flex h-dvh flex-col">
						<DrawerHeader>
							<div className="flex items-start gap-3 pr-10">
								<div className="min-w-0 flex-1">
									<DrawerTitle className="truncate">{detailProduct.nombre_producto}</DrawerTitle>
									<DrawerDescription className="mt-1">
										<span className="text-slate-600">{detailProduct.codigo_producto}</span>
										<span className="mx-2 text-slate-300">·</span>
										<span className="text-slate-600">{(props.inferCategoryFromCode(detailProduct.codigo_producto) ?? "N/D").toUpperCase()}</span>
									</DrawerDescription>
								</div>

								<span className={`mt-0.5 inline-flex shrink-0 items-center rounded-full px-3 py-1 text-xs font-semibold ${stockStatusClass}`}>
									Stock: {stockStatus ? productStockStatusLabel(stockStatus) : "—"}
								</span>
							</div>

							<div className="mt-4 flex flex-wrap items-center gap-2">
								<button
									type="button"
									onClick={props.onAdjustStock}
									className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
								>
									Ajustar stock
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
									onClick={props.onExportPdf}
									disabled={props.exportingPdf}
									className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
								>
									{props.exportingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
									Exportar
								</button>
							</div>
						</DrawerHeader>

						{(() => {
							const margin = computeMargin(detailProduct.precio_compra, detailProduct.precio_venta)
							const purchaseDisplay = detailProduct.precio_compra > 0 ? props.currency.format(detailProduct.precio_compra) : "—"
							const salesTotal = props.sales.isLoading || props.sales.isError ? null : (props.sales.data?.totalUnitsSold ?? 0)
							const lastSale = props.sales.isLoading || props.sales.isError ? null : props.sales.data?.lastSaleDate
							return (
								<div className="px-6 pt-4">
									<div className="grid gap-3 sm:grid-cols-3">
										<div className="rounded-2xl border border-slate-200 bg-white p-3">
											<p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Stock actual</p>
											<p className="mt-1 text-2xl font-semibold text-slate-900">{detailProduct.cantidad_stock}</p>
											<p className="mt-1 text-xs text-slate-500">Mínimo: {detailProduct.stock_minimo}</p>
										</div>
										<div className="rounded-2xl border border-slate-200 bg-white p-3">
											<p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total vendido</p>
											<p className="mt-1 text-2xl font-semibold text-slate-900">{salesTotal ?? "—"}</p>
											<div className="mt-1 flex flex-wrap items-center justify-between gap-2">
												<p className="text-xs text-slate-500">Unidades (histórico)</p>
												<button
													type="button"
													onClick={props.onHistory}
													className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
												>
													Ver ventas
												</button>
											</div>
										</div>
										<div className="rounded-2xl border border-slate-200 bg-white p-3">
											<p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Última venta</p>
											<p className="mt-2 text-sm font-semibold text-slate-900">
												{lastSale ? props.dateFormatter.format(new Date(lastSale)) : "—"}
											</p>
											<p className="mt-2 text-xs text-slate-500">Fecha de factura</p>
										</div>
									</div>

									<div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
										<p className="text-sm font-semibold text-slate-700">Información general</p>
										<div className="mt-3 grid gap-x-6 gap-y-4 sm:grid-cols-2">
											<div>
												<p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Proveedor</p>
												<p className="mt-1 text-sm font-semibold text-slate-900">{detailProduct.proveedor?.nombre_proveedor ?? "Sin proveedor"}</p>
											</div>
											<div>
												<p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Categoría</p>
												<p className="mt-1 text-sm font-semibold text-slate-900">{(props.inferCategoryFromCode(detailProduct.codigo_producto) ?? "N/D").toUpperCase()}</p>
											</div>
											<div>
												<p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Precio venta</p>
												<p className="mt-1 text-sm font-semibold text-slate-900">{props.currency.format(detailProduct.precio_venta)}</p>
											</div>
											<div>
												<p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Precio compra</p>
												<p className="mt-1 text-sm font-semibold text-slate-900">{purchaseDisplay}</p>
											</div>
											<div>
												<p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Margen</p>
												<p className="mt-1 text-sm font-semibold text-slate-900">{margin === null ? "—" : props.currency.format(margin)}</p>
											</div>
											<div>
												<p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Stock mínimo</p>
												<p className="mt-1 text-sm font-semibold text-slate-900">{detailProduct.stock_minimo}</p>
											</div>

											<div className="sm:col-span-2">
												<p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Descripción</p>
												<p className="mt-1 text-sm font-semibold text-slate-900">{detailProduct.descripcion?.trim() ? detailProduct.descripcion : "—"}</p>
											</div>
										</div>
									</div>
								</div>
							)
						})()}

						<div className="flex-1 overflow-y-auto px-6 pb-6 pt-4">
							<div className="rounded-2xl border border-slate-200 bg-white p-4">
								<div className="flex flex-wrap items-center justify-between gap-2">
									<p className="text-sm font-semibold text-slate-700">Historial de movimientos</p>
									<button
										type="button"
										onClick={() => setHistoryOpen(true)}
										className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
									>
										Ver historial completo
									</button>
								</div>

								{props.movements.isLoading ? (
									<p className="mt-2 flex items-center gap-2 text-sm text-slate-500">
										<Loader2 className="h-4 w-4 animate-spin" /> Cargando últimos movimientos...
									</p>
								) : props.movements.isError ? (
									<div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-700">
										<span className="text-slate-600">No se pudo cargar el historial.</span>
										<button
											type="button"
											onClick={props.onRetryMovements}
											className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
										>
											Reintentar
										</button>
									</div>
								) : visibleMovements.length === 0 ? (
									<div className="mt-3 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
										<p className="font-semibold text-slate-700">Todavía no hay movimientos.</p>
										<p className="mt-1">Cuando registres una compra, venta o ajuste de stock, aparecerá acá.</p>
									</div>
								) : (
									<div className="mt-3 max-h-56 overflow-auto rounded-xl ring-1 ring-slate-200">
										<table className="min-w-[680px] w-full text-sm">
											<thead className="sticky top-0 bg-white">
												<tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
													<th className="py-2 pl-3 pr-3">Tipo</th>
													<th className="py-2 pr-3">Fecha</th>
													<th className="py-2 pr-3">Cantidad</th>
													<th className="py-2 pr-3">Referencia</th>
												</tr>
											</thead>
											<tbody className="divide-y divide-slate-200">
												{visibleMovements.map((m) => {
													const type = buildMovementType(m)
													const qty = Number(m.cantidad ?? 0)
													const qtyText = `${qty > 0 ? "+" : ""}${qty}`
													const qtyClass = qty > 0 ? "text-emerald-700" : qty < 0 ? "text-red-700" : "text-slate-700"
													return (
														<tr key={m.id_kardex} className="align-top">
															<td className="py-2 pl-3 pr-3">
																<span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{type}</span>
															</td>
															<td className="py-2 pr-3 text-sm font-semibold text-slate-900">
																{m.fecha_movimiento ? props.dateFormatter.format(new Date(m.fecha_movimiento)) : "—"}
															</td>
															<td className={`py-2 pr-3 text-sm font-semibold ${qtyClass}`}>{qtyText}</td>
															<td className="py-2 pr-3 text-sm text-slate-700">{getMovementReference(m)}</td>
														</tr>
													)
												})}
											</tbody>
										</table>
									</div>
								)}
							</div>


						</div>

						<Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
							<DialogContent className="z-[60] w-full max-w-4xl">
								<DialogHead className="pr-10">
									<DialogTit>Historial completo</DialogTit>
									<DialogDesc>
										{detailProduct.nombre_producto} · {detailProduct.codigo_producto}
									</DialogDesc>
								</DialogHead>

								<button
									type="button"
									onClick={() => setHistoryOpen(false)}
									className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50"
									aria-label="Cerrar"
								>
									<X className="h-4 w-4" />
								</button>

								{fullHistoryQuery.isLoading ? (
									<p className="mt-2 flex items-center gap-2 text-sm text-slate-500">
										<Loader2 className="h-4 w-4 animate-spin" /> Cargando historial...
									</p>
								) : fullHistoryQuery.isError ? (
									<div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-700">
										<span className="text-slate-600">No se pudo cargar el historial completo.</span>
										<button
											type="button"
											onClick={() => fullHistoryQuery.refetch()}
											className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
										>
											Reintentar
										</button>
									</div>
								) : (fullHistoryQuery.data ?? []).length === 0 ? (
									<div className="mt-3 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
										<p className="font-semibold text-slate-700">No hay movimientos registrados.</p>
										<p className="mt-1">Cuando existan movimientos, los verás reflejados aquí.</p>
									</div>
								) : (
									<div className="mt-3 max-h-[60vh] overflow-auto rounded-xl ring-1 ring-slate-200">
										<table className="min-w-[760px] w-full text-sm">
											<thead className="sticky top-0 bg-white">
												<tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
													<th className="py-2 pl-3 pr-3">Tipo</th>
													<th className="py-2 pr-3">Fecha</th>
													<th className="py-2 pr-3">Cantidad</th>
													<th className="py-2 pr-3">Referencia</th>
												</tr>
											</thead>
											<tbody className="divide-y divide-slate-200">
												{(fullHistoryQuery.data ?? []).map((m) => {
													const type = buildMovementType(m)
													const qty = Number(m.cantidad ?? 0)
													const qtyText = `${qty > 0 ? "+" : ""}${qty}`
													const qtyClass = qty > 0 ? "text-emerald-700" : qty < 0 ? "text-red-700" : "text-slate-700"
													return (
														<tr key={m.id_kardex} className="align-top">
															<td className="py-2 pl-3 pr-3"><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{type}</span></td>
															<td className="py-2 pr-3 text-sm font-semibold text-slate-900">{m.fecha_movimiento ? props.dateFormatter.format(new Date(m.fecha_movimiento)) : "—"}</td>
															<td className={`py-2 pr-3 text-sm font-semibold ${qtyClass}`}>{qtyText}</td>
															<td className="py-2 pr-3 text-sm text-slate-700">{getMovementReference(m)}</td>
														</tr>
													)
												})}
											</tbody>
										</table>
									</div>
								)}
							</DialogContent>
						</Dialog>
					</div>
				)}
			</DrawerContent>
		</Drawer>
	)
}

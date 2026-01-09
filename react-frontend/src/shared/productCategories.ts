export const productCategories = [
	{ value: "cuerdas", label: "Cuerdas", prefix: "CRD" },
	{ value: "amplificadores", label: "Amplificadores", prefix: "AMP" },
	{ value: "accesorios", label: "Accesorios", prefix: "ACC" },
	{ value: "guitarras", label: "Guitarras", prefix: "GTR" },
	{ value: "bajos", label: "Bajos", prefix: "BAS" },
	{ value: "percusion", label: "Percusión", prefix: "PER" },
] as const

export type ProductCategoryValue = (typeof productCategories)[number]["value"]

const categoryByValue = new Map<ProductCategoryValue, string>()
const categoryByPrefix = new Map<string, ProductCategoryValue>()

productCategories.forEach((item) => {
	categoryByValue.set(item.value, item.prefix)
	categoryByPrefix.set(item.prefix, item.value)
})

export const getCategoryPrefix = (value: ProductCategoryValue | "") =>
	value ? categoryByValue.get(value) ?? null : null

export const matchCategoryValue = (value: string): ProductCategoryValue | null => {
	const raw = value.trim()
	if (!raw) return null

	const byPrefix = categoryByPrefix.get(raw.toUpperCase())
	if (byPrefix) return byPrefix

	const normalized = raw.toLowerCase()
	return (
		productCategories.find(
			(item) =>
				item.value === normalized ||
				item.label.toLowerCase().includes(normalized) ||
				normalized.includes(item.prefix.toLowerCase())
		)?.value ?? null
	)
}

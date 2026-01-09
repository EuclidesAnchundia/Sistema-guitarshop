import { useQuery } from "@tanstack/react-query"
import { compraClient } from "./compra.client"

export const comprasQueryKey = ["compras"]

export function useComprasQuery(options?: { enabled?: boolean }) {
	return useQuery({
		queryKey: comprasQueryKey,
		queryFn: () => compraClient.getAll(),
		enabled: options?.enabled,
	})
}
import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"

type Props = {
  children: React.ReactNode
}

export function PrintRootPortal({ children }: Props) {
  const [printRoot, setPrintRoot] = useState<HTMLElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    let root = document.getElementById("invoice-print")
    
    if (!root) {
      root = document.createElement("div")
      root.id = "invoice-print"
      document.body.appendChild(root)
    }

    // Crear contenedor dedicado y reemplazar hijos previos
    const container = document.createElement("div")
    container.setAttribute("data-print-container", "true")
    root.replaceChildren(container)
    containerRef.current = container
    setPrintRoot(root)

    return () => {
      // Limpiar al desmontar solo si somos el contenedor actual
      if (root && containerRef.current && root.contains(containerRef.current)) {
        root.removeChild(containerRef.current)
      }
    }
  }, [])

  if (!printRoot) return null

  return createPortal(children, containerRef.current ?? document.body)
}

import jsPDF from "jspdf"
import html2canvas from "html2canvas"
import type { VentaDetailRecord } from "../../../services/salesService"

export async function downloadSalePdf(venta: VentaDetailRecord) {
  const printRoot = document.getElementById("print-root")
  
  if (!printRoot) {
    console.error("No se encontró el elemento print-root")
    return
  }

  try {
    // Hacer visible temporalmente para captura
    printRoot.style.display = "block"
    printRoot.style.position = "absolute"
    printRoot.style.left = "-9999px"
    
    const canvas = await html2canvas(printRoot, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: "#ffffff",
      width: 794, // A4 width in pixels at 96 DPI (210mm)
      height: 1123, // A4 height in pixels at 96 DPI (297mm)
    })

    // Ocultar de nuevo
    printRoot.style.display = ""
    printRoot.style.position = ""
    printRoot.style.left = ""

    const imgData = canvas.toDataURL("image/png")
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    })

    const imgWidth = 210 // A4 width in mm
    const imgHeight = (canvas.height * imgWidth) / canvas.width

    pdf.addImage(imgData, "PNG", 0, 0, imgWidth, imgHeight)

    const safeNumero = (venta.numero_factura || "venta").replace(/[^a-zA-Z0-9-_]/g, "_")
    pdf.save(`Factura_${safeNumero}.pdf`)
  } catch (error) {
    console.error("Error generando PDF:", error)
    // Asegurar que se oculte el elemento
    printRoot.style.display = ""
    printRoot.style.position = ""
    printRoot.style.left = ""
  }
}

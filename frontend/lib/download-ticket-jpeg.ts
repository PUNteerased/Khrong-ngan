import { toJpeg } from "html-to-image"

export async function downloadTicketJpeg(
  element: HTMLElement,
  filename: string
): Promise<void> {
  const dataUrl = await toJpeg(element, {
    quality: 0.92,
    pixelRatio: 2,
    cacheBust: true,
    backgroundColor: "#ffffff",
  })

  const a = document.createElement("a")
  a.href = dataUrl
  a.download = filename.endsWith(".jpg") ? filename : `${filename}.jpg`
  document.body.appendChild(a)
  a.click()
  a.remove()
}

export function ticketJpegFilename(code: string): string {
  const safe = code.replace(/[^A-Za-z0-9-]/g, "_")
  return `laneya-ticket-${safe}.jpg`
}

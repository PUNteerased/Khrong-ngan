import { readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { Resvg } from "@resvg/resvg-js"

const __dirname = dirname(fileURLToPath(import.meta.url))
const svgPath = join(__dirname, "../public/kiosk/capsi-mascot.svg")
const svg = readFileSync(svgPath, "utf8")

for (const size of [512, 1024]) {
  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: size },
    background: "transparent",
  })
  const png = resvg.render().asPng()
  const out = join(__dirname, `../public/kiosk/capsi-mascot-${size}.png`)
  writeFileSync(out, png)
  console.log(`Wrote ${out}`)
}

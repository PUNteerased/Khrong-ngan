import "./load-env.js"
import express from "express"
import cors from "cors"
import helmet from "helmet"
import { router } from "./routes/index.js"

const app = express()
const port = Number(process.env.PORT) || 4000
const corsOriginRaw = process.env.CORS_ORIGIN || "http://localhost:3000"
const allowedOrigins = corsOriginRaw
  .split(",")
  .map((v) => v.trim())
  .filter(Boolean)

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
)
app.use(
  cors({
    origin(origin, callback) {
      // Allow non-browser tools/no-origin requests (health checks, curl, etc.)
      if (!origin) {
        callback(null, true)
        return
      }
      if (allowedOrigins.includes(origin)) {
        callback(null, true)
        return
      }
      callback(new Error(`Not allowed by CORS: ${origin}`))
    },
    credentials: true,
  })
)
app.use(express.json({ limit: "2mb" }))
app.use(router)

app.listen(port, () => {
  const hasDify = Boolean(process.env.DIFY_API_KEY?.trim())
  console.log(`LaneYa API http://localhost:${port}`)
  if (!hasDify) {
    console.warn(
      "[LaneYa API] DIFY_API_KEY ยังว่าง — แชท AI จะไม่ทำงานจนกว่าจะตั้งใน backend/.env"
    )
  }
})

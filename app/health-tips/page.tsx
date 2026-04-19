import { healthArticles } from "@/data/health-articles"
import { HealthTipCard } from "@/components/health-tip-card"

export const metadata = {
  title: "เกร็ดความรู้สุขภาพ | LaneYa",
  description:
    "บทความสั้นเกี่ยวกับการใช้ยา การป้องกันโรค และไลฟ์สไตล์ พร้อมแหล่งอ้างอิง",
}

export default function HealthTipsIndexPage() {
  return (
    <div className="mx-auto max-w-lg px-4 py-6 pb-10">
      <div className="mb-6 space-y-1">
        <h1 className="text-xl font-semibold text-foreground">
          เกร็ดความรู้สุขภาพ
        </h1>
        <p className="text-sm text-muted-foreground">
          เลือกหัวข้อเพื่ออ่านรายละเอียดและอ้างอิงแหล่งที่มา
        </p>
      </div>

      <ul className="space-y-3">
        {healthArticles.map((article) => (
          <li key={article.slug}>
            <HealthTipCard article={article} />
          </li>
        ))}
      </ul>
    </div>
  )
}

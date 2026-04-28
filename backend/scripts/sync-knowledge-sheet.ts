import "../src/load-env.js"
import { syncKnowledgeFromSheet } from "../src/services/knowledgeSheetSync.service.js"

async function main() {
  const dryRun = process.argv.includes("--dry-run") || process.argv.includes("--dryRun")
  const result = await syncKnowledgeFromSheet({ dryRun })
  console.log(JSON.stringify(result, null, 2))
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })

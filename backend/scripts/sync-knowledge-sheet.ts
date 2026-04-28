import "../src/load-env.js"
import { syncKnowledgeFromSheet } from "../src/services/knowledgeSheetSync.service.js"

async function main() {
  const result = await syncKnowledgeFromSheet({ dryRun: false })
  console.log(JSON.stringify(result, null, 2))
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })

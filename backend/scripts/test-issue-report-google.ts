import "dotenv/config"
import { probeIssueReportGoogleAccess } from "../src/services/issueReportGoogle.service.js"

const result = await probeIssueReportGoogleAccess()
console.log(JSON.stringify(result, null, 2))
process.exit(result.ok ? 0 : 1)

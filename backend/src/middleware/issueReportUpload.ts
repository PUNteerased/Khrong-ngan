import multer from "multer"

const MAX_IMAGE_BYTES = 5 * 1024 * 1024

export const issueReportUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES, files: 1 },
  fileFilter(_req, file, cb) {
    if (!file.mimetype.startsWith("image/")) {
      cb(new Error("รองรับเฉพาะไฟล์รูปภาพเท่านั้น"))
      return
    }
    cb(null, true)
  },
})

import multer from "multer"

const MAX_IMAGE_BYTES = 5 * 1024 * 1024

export const issueReportUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES, files: 1 },
  fileFilter(_req, file, cb) {
    const allowed = new Set(["image/jpeg", "image/jpg", "image/png"])
    if (!allowed.has(file.mimetype.toLowerCase())) {
      cb(new Error("รองรับเฉพาะไฟล์ PNG หรือ JPG เท่านั้น"))
      return
    }
    cb(null, true)
  },
})

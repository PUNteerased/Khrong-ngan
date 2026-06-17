import multer from "multer"

const MAX_IMAGE_BYTES = 5 * 1024 * 1024

export const issueReportUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES, files: 1 },
  fileFilter(_req, file, cb) {
<<<<<<< HEAD
    const allowed = new Set(["image/jpeg", "image/jpg", "image/png"])
    if (!allowed.has(file.mimetype.toLowerCase())) {
      cb(new Error("รองรับเฉพาะไฟล์ PNG หรือ JPG เท่านั้น"))
=======
    if (!file.mimetype.startsWith("image/")) {
      cb(new Error("รองรับเฉพาะไฟล์รูปภาพเท่านั้น"))
>>>>>>> 61d7091de1b9bac3545ffb074da53557375756e1
      return
    }
    cb(null, true)
  },
})

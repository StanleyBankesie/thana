// upload.js - Multer configuration for handling in-memory file uploads
import multer from "multer";

// Use memory storage so we can directly parse the buffer without writing to disk
const storage = multer.memoryStorage();

export const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowed = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only Excel files are allowed"), false);
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB limit
});

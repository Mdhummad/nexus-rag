import multer from "multer";

const MAX_SIZE_MB = parseInt(process.env.MAX_FILE_SIZE_MB) || 50;

export const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_SIZE_MB * 1024 * 1024 },
    fileFilter(_req, file, cb) {
        if (file.mimetype === "application/pdf" || file.originalname.toLowerCase().endsWith(".pdf")) {
            cb(null, true);
        } else {
            cb(new Error("Only PDF files are supported"));
        }
    },
});
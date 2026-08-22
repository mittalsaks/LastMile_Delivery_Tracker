// middleware/uploadMiddleware.js
// Handles KYC document uploads submitted by a delivery agent at registration.
//
// Files are written to disk under backend/uploads/agent-docs/ (NOT inside a
// publicly-served static folder — see app.js, which does not expose this
// directory). They can only be retrieved again through the admin-only,
// authenticated download route defined in agentRoutes.js.

const fs = require("fs");
const path = require("path");
const multer = require("multer");

const UPLOAD_DIR = path.join(__dirname, "..", "..", "uploads", "agent-docs");

// Make sure the folder exists before multer tries to write into it.
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB per file

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, `${file.fieldname}-${safeSuffix}${ext}`);
  },
});

function fileFilter(req, file, cb) {
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    return cb(new Error("Only JPG, PNG, WEBP or PDF files are allowed for identity documents"));
  }
  cb(null, true);
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
});

// Agent registration submits three optional-by-field, checked-in-controller
// document uploads. Aadhaar + Driving License are required for agents; PAN
// is optional. Enforcement of "required" happens in authController.js so we
// can return one clean validation message instead of multer's raw errors.
const agentDocumentFields = upload.fields([
  { name: "aadhaarDoc", maxCount: 1 },
  { name: "panDoc", maxCount: 1 },
  { name: "drivingLicenseDoc", maxCount: 1 },
]);

// Wraps multer so its errors come back as normal JSON instead of crashing
// past the global error handler with an unhelpful stack trace.
function handleAgentDocuments(req, res, next) {
  agentDocumentFields(req, res, (err) => {
    if (err) {
      return res.status(400).json({ message: err.message || "File upload failed" });
    }
    next();
  });
}

module.exports = { handleAgentDocuments, UPLOAD_DIR };
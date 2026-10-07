import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import multer from "multer";
import { assert } from "../utils/errors.js";
export const uploadRoot = fileURLToPath(
  new URL("../uploads/", import.meta.url),
);
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 1 },
  fileFilter(req, file, cb) {
    const allowed = {
      "image/jpeg": [".jpg", ".jpeg"],
      "image/png": [".png"],
      "image/webp": [".webp"],
      "application/pdf": [".pdf"],
    };
    if (
      !allowed[file.mimetype]?.includes(
        path.extname(file.originalname).toLowerCase(),
      )
    )
      return cb(
        Object.assign(new Error("Use JPG, PNG, WEBP or PDF files"), {
          status: 400,
        }),
      );
    cb(null, true);
  },
});
export async function saveFile(file) {
  assert(file, "Choose a file");
  const b = file.buffer;
  const valid =
    file.mimetype === "image/jpeg"
      ? b[0] === 255 && b[1] === 216 && b[2] === 255
      : file.mimetype === "image/png"
        ? b
            .subarray(0, 8)
            .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
        : file.mimetype === "image/webp"
          ? b.subarray(0, 4).toString() === "RIFF" &&
            b.subarray(8, 12).toString() === "WEBP"
          : b.subarray(0, 5).toString() === "%PDF-";
  assert(valid, "File content does not match its format");
  await fs.mkdir(uploadRoot, { recursive: true });
  const filename =
    crypto.randomUUID() + path.extname(file.originalname).toLowerCase();
  await fs.writeFile(path.join(uploadRoot, filename), b);
  return {
    filename,
    originalName: path.basename(file.originalname),
    mime: file.mimetype,
    size: file.size,
  };
}
export async function deleteStoredFile(filename) {
  if (filename && path.basename(filename) === filename)
    await fs.unlink(path.join(uploadRoot, filename)).catch((e) => {
      if (e.code !== "ENOENT") throw e;
    });
}
// Implement this interface with a signed private Cloudinary provider when external hosting is enabled.
export const localStorage = { save: saveFile, remove: deleteStoredFile };

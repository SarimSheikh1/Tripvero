import { ZodError } from "zod";
export function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);
  let status = error.status || 500,
    message = error.message || "Something went wrong";
  if (error instanceof ZodError) {
    status = 400;
    message = error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
  }
  if (error.code === 11000) {
    status = 409;
    message = "This email or record already exists";
  }
  if (error.name === "CastError" || error.name === "ValidationError") {
    status = 400;
    message = "Please check the submitted fields";
  }
  if (error.code === "LIMIT_FILE_SIZE") {
    status = 400;
    message = "Files must be 8 MB or smaller";
  }
  if (status === 500) {
    console.error(error);
    message = "The request could not be completed. Please try again.";
  }
  res.status(status).json({ message });
}

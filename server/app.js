import express from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "./config/env.js";
import { api } from "./routes/index.js";
import { csrf } from "./middleware/auth.js";
import { errorHandler } from "./middleware/errors.js";
export const app = express();
app.disable("x-powered-by");
app.use(
  helmet({
    contentSecurityPolicy: config.production
      ? {
          directives: {
            defaultSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "blob:", "https://images.unsplash.com"],
            connectSrc: ["'self'", config.client],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            objectSrc: ["'none'"],
          },
        }
      : false,
  }),
);
app.use(cors({ origin: config.client, credentials: true }));
app.use(
  rateLimit({
    windowMs: 60000,
    limit: 300,
    standardHeaders: "draft-8",
    legacyHeaders: false,
  }),
);
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());
app.use((req, res, next) => {
  req.body ??= {};
  next();
});
app.use("/api", csrf, api);
if (config.production) {
  const publicDir = fileURLToPath(new URL("../client/dist/", import.meta.url));
  app.use(express.static(publicDir));
  app.get("/{*path}", (req, res) =>
    res.sendFile(path.join(publicDir, "index.html")),
  );
}
app.use((req, res) => res.status(404).json({ message: "Route not found" }));
app.use(errorHandler);

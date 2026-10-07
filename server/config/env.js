import dotenv from "dotenv";
dotenv.config();
export const config = {
  port: Number(process.env.PORT || 5000),
  mongo: process.env.MONGODB_URI,
  jwt: process.env.JWT_SECRET,
  client: process.env.CLIENT_URL || "http://localhost:5173",
  production: process.env.NODE_ENV === "production",
};
export function validateConfig() {
  if (!config.mongo) throw new Error("Set MONGODB_URI in server/.env");
  if (
    !config.jwt ||
    config.jwt.length < 32 ||
    config.jwt.startsWith("replace-")
  )
    throw new Error(
      "Set JWT_SECRET to a random value of at least 32 characters",
    );
}

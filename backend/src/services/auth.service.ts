import bcrypt from "bcryptjs"
import jwt from "jsonwebtoken"
import type { AuthPayload } from "../middleware/auth.js"

const SALT_ROUNDS = 10

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS)
}

export async function verifyPassword(
  plain: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(plain, hash)
}

export function signToken(payload: AuthPayload): string {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error("JWT_SECRET is not set")
  return jwt.sign(payload, secret, { expiresIn: "7d" })
}

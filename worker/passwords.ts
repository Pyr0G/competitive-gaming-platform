import { DurableObject } from "cloudflare:workers";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const parameters = { N: 16384, r: 8, p: 5, maxmem: 32 * 1024 * 1024 };
const recordPattern = /^scrypt\$16384\$8\$5\$([a-f0-9]{32})\$([a-f0-9]{64})$/;

export const dummyPasswordHash = `scrypt$16384$8$5$${"0".repeat(32)}$${"0".repeat(64)}`;

export class PasswordHasher extends DurableObject {
  async hash(password: string): Promise<string> {
    if (
      typeof password !== "string" ||
      Buffer.byteLength(password, "utf8") > 1024
    ) {
      throw new Error("INVALID_PASSWORD");
    }

    const salt = randomBytes(16);
    const derived = scryptSync(password, salt, 32, parameters);
    return `scrypt$16384$8$5$${salt.toString("hex")}$${derived.toString("hex")}`;
  }

  async verify(password: string, record: string): Promise<boolean> {
    if (
      typeof password !== "string" ||
      Buffer.byteLength(password, "utf8") > 1024
    )
      return false;
    if (typeof record !== "string") return false;
    const match = recordPattern.exec(record);
    if (!match) return false;

    const salt = Buffer.from(match[1], "hex");
    const expected = Buffer.from(match[2], "hex");
    const derived = scryptSync(password, salt, 32, parameters);
    return timingSafeEqual(derived, expected);
  }
}

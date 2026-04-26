/**
 * Create an API key row (hash stored). Prints the secret once to stdout.
 * Usage (from repo root):
 *   set DATABASE_URL=file:./packages/aegros-server/prisma/dev.db
 *   node packages/aegros-server/scripts/create-api-key.mjs "CI robot"
 */
import { createHash, randomBytes } from 'node:crypto';
import { PrismaClient } from '@prisma/client';

const name = process.argv[2] ?? 'default';
const prisma = new PrismaClient();
const raw = `aeg_${randomBytes(24).toString('base64url')}`;
const keyHash = createHash('sha256').update(raw, 'utf8').digest('hex');
const row = await prisma.apiKey.create({
  data: { name, keyHash, role: 'operator' },
});
await prisma.$disconnect();
process.stdout.write(
  `Created key id=${row.id}\nStore this secret (shown once):\n${raw}\nUse header: X-API-Key: ${raw}\n`,
);

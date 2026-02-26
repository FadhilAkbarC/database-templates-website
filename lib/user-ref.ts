import { withDb } from '@/lib/db';
import { AppError } from '@/lib/errors';
import { slugify } from '@/lib/utils';

function buildUsernameFromRef(input: string): string {
  const compact = slugify(input).replace(/-/g, '').slice(0, 24);
  return compact || `user${Date.now()}`;
}

export async function resolveOrCreateUserId(userRef: string): Promise<string> {
  const trimmed = userRef.trim();
  if (!trimmed) {
    throw new AppError('userRef is required', 400);
  }

  return withDb(async (db) => {
    const byId = await db.user.findUnique({ where: { id: trimmed }, select: { id: true } });
    if (byId) return byId.id;

    const byUsername = await db.user.findUnique({ where: { username: trimmed }, select: { id: true } });
    if (byUsername) return byUsername.id;

    const username = buildUsernameFromRef(trimmed);
    const displayName = trimmed.slice(0, 60);

    const created = await db.user.upsert({
      where: { username },
      update: { displayName },
      create: { username, displayName }
    });

    return created.id;
  });
}

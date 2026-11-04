import { db } from '../db/db';

export async function resetTestDatabase(): Promise<void> {
  await db.open();
  await db.transaction(
    'rw',
    [
      db.settings,
      db.mocks,
      db.mistakes,
      db.papers,
      db.paperAttempts,
      db.images,
      db.importBatches,
      db.tasks,
      db.profiles
    ],
    async () => {
      await Promise.all([
        db.settings.clear(),
        db.mocks.clear(),
        db.mistakes.clear(),
        db.papers.clear(),
        db.paperAttempts.clear(),
        db.images.clear(),
        db.importBatches.clear(),
        db.tasks.clear(),
        db.profiles.clear()
      ]);
    }
  );
}

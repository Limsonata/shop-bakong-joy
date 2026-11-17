// Server-only: attribute service-role writes in the audit log.
// The audit trigger (migration 20261117110000) reads `changed_by` from the row
// being written, logs it and clears it again.

type WriteResult<T> = { data: T; error: { message: string } | null };

/**
 * Run an insert/update with `changed_by` set to `actor` (an admin user id or a
 * label like "Telegram: Nata"). If the audit migration has not run yet the
 * column is missing, so the write is retried without it rather than failing.
 */
export async function writeWithActor<T>(
  run: (row: Record<string, unknown>) => PromiseLike<WriteResult<T>>,
  row: Record<string, unknown>,
  actor?: string | null,
): Promise<WriteResult<T>> {
  if (!actor) return run(row);
  const first = await run({ ...row, changed_by: actor });
  if (first.error && first.error.message.includes("changed_by")) return run(row);
  return first;
}

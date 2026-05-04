/**
 * Every fallible operation returns a Result.
 * The `ok` discriminant lets TypeScript narrow the type at the call site —
 * you must check `result.ok` before accessing `result.data` or `result.error`.
 */
export type Result<T> = { ok: true; data: T } | { ok: false; error: string }

/** Shape of error bodies returned by the WhisperBox API */
export interface ApiErrorBody {
  detail: string
}

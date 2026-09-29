/**
 * The envelope every Server Action returns to the browser. It mirrors the API
 * envelope so client components handle action and API errors the same way.
 */
export interface ActionResult {
  resultCode: number;
  success: boolean;
  message: string;
  data: { id: number } | null;
}

/** Builds an {@link ActionResult}; `id` is the created or updated row, when there is one. */
export function actionResult(resultCode: number, message: string, id?: number): ActionResult {
  return { resultCode, success: resultCode < 400, message, data: id ? { id } : null };
}

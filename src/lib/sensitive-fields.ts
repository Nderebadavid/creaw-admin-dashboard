// Columns labelled “sensitive field” in the SQL DDL, plus legal_case.ob_number, which the
// VAWG design mandates as sensitive. Participant names are deliberately shown in full
// (a product decision); ID number and phone stay masked behind the audited reveal.
export const SENSITIVE_FIELDS: Readonly<Record<string, readonly string[]>> = {
  user: ["password_hash", "phone_number", "email"],
  participant: ["id_number", "phone_number"],
  organisation: ["has_bank_account", "financial_mgmt_notes"],
  external_provider: ["phone_number", "email"],
  document: ["file_url"],
  legal_case: ["outcome_notes", "ob_number"],
  counselling_session: ["notes"],
  training_enrollment: ["monthly_salary"],
  grant_award: ["amount_awarded"],
  grant_disbursement: ["amount"],
};

export function isSensitiveField(table: string, column: string): boolean {
  return Object.hasOwn(SENSITIVE_FIELDS, table) && SENSITIVE_FIELDS[table].includes(column);
}

export function maskSensitiveValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return "••••";
  const text = String(value);
  return text.length <= 4 ? "•".repeat(text.length) : "•".repeat(text.length - 4) + text.slice(-4);
}

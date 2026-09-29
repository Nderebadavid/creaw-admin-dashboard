// Only columns explicitly labelled “sensitive field” in the SQL DDL.
export const SENSITIVE_FIELDS: Readonly<Record<string, readonly string[]>> = {
  "user": [
    "password_hash",
    "phone_number",
    "email"
  ],
  "participant": [
    "first_name",
    "middle_name",
    "last_name",
    "id_number",
    "phone_number"
  ],
  "organisation": [
    "has_bank_account",
    "financial_mgmt_notes"
  ],
  "external_provider": [
    "phone_number",
    "email"
  ],
  "document": [
    "file_url"
  ],
  "legal_case": [
    "outcome_notes"
  ],
  "counselling_session": [
    "notes"
  ],
  "training_enrollment": [
    "monthly_salary"
  ],
  "grant_award": [
    "amount_awarded"
  ],
  "grant_disbursement": [
    "amount"
  ]
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

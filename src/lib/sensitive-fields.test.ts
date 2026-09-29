import { describe, expect, it } from "vitest";
import { isSensitiveField, maskSensitiveValue } from "./sensitive-fields";
describe("schema sensitivity", () => {
  it("maps the SQL sensitive-field comments without inventing sensitive columns", () => {
    for (const [table, column] of [
      ["participant", "first_name"],
      ["participant", "id_number"],
      ["user", "password_hash"],
      ["organisation", "has_bank_account"],
      ["document", "file_url"],
      ["legal_case", "outcome_notes"],
      ["counselling_session", "notes"],
      ["training_enrollment", "monthly_salary"],
      ["grant_award", "amount_awarded"],
      ["grant_disbursement", "amount"],
    ])
      expect(isSensitiveField(table, column)).toBe(true);
    expect(isSensitiveField("participant", "gender")).toBe(false);
    expect(isSensitiveField("grant_application", "requested_amount")).toBe(false);
    expect(isSensitiveField("toString", "name")).toBe(false);
  });
  it("masks short values completely and preserves only the last four of long values", () => {
    expect(maskSensitiveValue("0712345678")).toBe("••••••5678");
    expect(maskSensitiveValue("123")).toBe("•••");
    expect(maskSensitiveValue(null)).toBe("—");
    expect(maskSensitiveValue(true)).toBe("••••");
  });
});

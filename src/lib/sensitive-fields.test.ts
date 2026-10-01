import { describe, expect, it } from "vitest";
import { isSensitiveField, maskSensitiveValue } from "./sensitive-fields";
describe("schema sensitivity", () => {
  it("maps the sensitive columns and leaves ordinary ones open", () => {
    for (const [table, column] of [
      ["participant", "id_number"],
      ["participant", "phone_number"],
      ["user", "password_hash"],
      ["organisation", "has_bank_account"],
      ["document", "file_url"],
      ["legal_case", "outcome_notes"],
      ["legal_case", "ob_number"],
      ["counselling_session", "notes"],
      ["training_enrollment", "monthly_salary"],
      ["grant_award", "amount_awarded"],
      ["grant_disbursement", "amount"],
    ])
      expect(isSensitiveField(table, column)).toBe(true);
    expect(isSensitiveField("participant", "gender")).toBe(false);
    for (const column of ["first_name", "middle_name", "last_name"])
      expect(isSensitiveField("participant", column)).toBe(false);
    expect(isSensitiveField("grant_application", "requested_amount")).toBe(false);
    expect(isSensitiveField("toString", "name")).toBe(false);
  });
  it("masks short values completely and preserves only the last four of long values", () => {
    expect(maskSensitiveValue("0712345678")).toBe("••••••5678");
    expect(maskSensitiveValue("123")).toBe("•••");
    // Long free text gets a short fixed mask: nothing of the note, not even its length.
    const note = "Survivor was referred to the safe house after the hearing was closed";
    expect(maskSensitiveValue(note)).toBe("•".repeat(12));
    expect(maskSensitiveValue(`${note} and the file was sealed`)).toBe("•".repeat(12));
    expect(maskSensitiveValue(null)).toBe("—");
    expect(maskSensitiveValue(true)).toBe("••••");
    expect(maskSensitiveValue("OB/44/2026")).toMatch(/•+2026$/);
  });
});

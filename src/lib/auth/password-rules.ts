/** The rules a new password must meet, shared by the reset form and the API. */
export const PASSWORD_RULES: ReadonlyArray<{ label: string; test: (password: string) => boolean }> =
  [
    { label: "At least 10 characters", test: (password) => password.length >= 10 },
    {
      label: "Upper & lower case",
      test: (password) => /[a-z]/.test(password) && /[A-Z]/.test(password),
    },
    { label: "A number", test: (password) => /\d/.test(password) },
    { label: "A symbol", test: (password) => /[^A-Za-z0-9]/.test(password) },
  ];

/** How many of the rules a password meets, from 0 to `PASSWORD_RULES.length`. */
export function passwordScore(password: string): number {
  return PASSWORD_RULES.filter((rule) => rule.test(password)).length;
}

export function isStrongPassword(password: string): boolean {
  return passwordScore(password) === PASSWORD_RULES.length;
}

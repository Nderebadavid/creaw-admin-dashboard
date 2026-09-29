import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const src = join(process.cwd(), "src");

// Palette colours used often enough to deserve a name. Components use the
// token (e.g. `text-creaw-muted`) so a palette change is a one-line edit.
const tokens: Record<string, string> = {
  "creaw-orange": "#b4552e",
  "creaw-orange-soft": "#fbede5",
  "creaw-ink": "#221c18",
  "creaw-ink-soft": "#4a413a",
  "creaw-body": "#6b625b",
  "creaw-muted": "#81766d",
  "creaw-faint": "#8a8078",
  "creaw-canvas": "#f7f4f0",
  "creaw-surface": "#fcfaf7",
  "creaw-line": "#ece6df",
  "creaw-line-strong": "#e2dbd3",
  "creaw-divider": "#f1ece6",
  "creaw-danger": "#b8352c",
  "creaw-danger-soft": "#fbe9e6",
  "creaw-success": "#246842",
  "creaw-success-soft": "#eaf5ed",
};

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

describe("design tokens", () => {
  const css = readFileSync(join(src, "app/globals.css"), "utf8").toLowerCase();

  it.each(Object.entries(tokens))("defines %s as %s with a Tailwind colour", (name, hex) => {
    expect(css).toContain(`--${name}: ${hex};`);
    expect(css).toContain(`--color-${name}: var(--${name});`);
  });

  it("uses tokens instead of hard-coded palette hex values in class names", () => {
    const palette = new Set(Object.values(tokens));
    const offenders = sources(src).flatMap((file) =>
      [...readFileSync(file, "utf8").matchAll(/-\[(#[0-9a-fA-F]{6})\]/g)]
        .filter((match) => palette.has(match[1].toLowerCase()))
        .map((match) => `${file.slice(src.length + 1)} ${match[0]}`)
    );
    expect(offenders).toEqual([]);
  });
});

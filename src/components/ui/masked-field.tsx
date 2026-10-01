/**
 * A sensitive value as the API sends it, already masked. It is never unmasked in the
 * portal: there is no reveal, so the masked text is all anyone sees.
 */
export function MaskedField({ label, maskedValue }: { label: string; maskedValue: string }) {
  return (
    <span aria-label={label} className="inline-block max-w-full break-all font-mono">
      {maskedValue}
    </span>
  );
}

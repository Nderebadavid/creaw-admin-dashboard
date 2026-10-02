import { act, fireEvent, screen, within } from "@testing-library/react";

/** The text box of a searchable select, found by its label, optionally inside `scope`. */
export function selectInput(label: string, scope?: HTMLElement): HTMLInputElement {
  const queries = scope ? within(scope) : screen;
  return queries.getByRole("combobox", { name: label, hidden: true }) as HTMLInputElement;
}

/**
 * Types into a searchable select and opens its list, as a user would. jsdom does not
 * fire the input events that open the list while typing, so the list is opened with the
 * dropdown button after the text is entered.
 */
export async function searchSelect(label: string, text: string, scope?: HTMLElement) {
  const input = selectInput(label, scope);
  await act(async () => {
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: text } });
  });
  const trigger = input.parentElement!.querySelector('button[aria-label^="Show"]')!;
  await act(async () => fireEvent.click(trigger));
  return input;
}

/** Types `text` into a searchable select and picks the option labelled `option`. */
export async function chooseOption(
  label: string,
  text: string,
  option = text,
  scope?: HTMLElement
) {
  await searchSelect(label, text, scope);
  await act(async () => fireEvent.click(await screen.findByRole("option", { name: option })));
}

/** Empties a searchable select, as deleting its text does. */
export async function clearSelect(label: string, scope?: HTMLElement) {
  const input = selectInput(label, scope);
  await act(async () => {
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.blur(input);
  });
}

/** The labels a searchable select offers for `text` (all of them for ""). */
export async function optionLabels(label: string, text = "", scope?: HTMLElement) {
  await searchSelect(label, text, scope);
  const labels = (await screen.findAllByRole("option")).map((option) => option.textContent);
  await act(async () => fireEvent.keyDown(selectInput(label, scope), { key: "Escape" }));
  return labels;
}

/** The value a searchable select will submit under form field `name`. */
export function submittedValue(name: string, scope: ParentNode = document) {
  return (scope.querySelector(`input[name="${name}"]`) as HTMLInputElement | null)?.value ?? null;
}

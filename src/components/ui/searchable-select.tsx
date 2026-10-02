"use client";
import { useId, useMemo } from "react";
import { Combobox } from "@base-ui/react/combobox";
import { ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { fieldClass, filterSelectClass } from "./form-styles";

export interface SelectOption {
  value: string | number;
  label: string;
  /** A heading the option is listed under, e.g. "CREAW staff". Options keep their order. */
  group?: string;
}

interface Item {
  value: string;
  label: string;
}
interface ItemGroup {
  value: string;
  items: Item[];
}

const renderItem = (item: Item) => (
  <Combobox.Item
    key={item.value}
    value={item}
    className="cursor-default px-3 py-2 text-creaw-ink outline-none data-[highlighted]:bg-creaw-orange-soft data-[selected]:font-semibold"
  >
    {item.label}
  </Combobox.Item>
);

/**
 * A dropdown that filters its options as the user types, for lists that come from data
 * and can grow long (people, places, projects, institutions). Short fixed lists such as
 * a status or gender stay native `<select>`s.
 *
 * With `name`, the chosen value is submitted with the form as a string ("" when nothing
 * is chosen), exactly like a native select. Without it, use `value` + `onChange`.
 */
export function SearchableSelect({
  options,
  name,
  value,
  defaultValue,
  onChange,
  emptyLabel,
  label,
  required,
  disabled,
  compact = false,
  className,
}: {
  options: readonly SelectOption[];
  /** Form field name; the value is submitted like a native select's. */
  name?: string;
  /** Controlled value; "" or null for nothing chosen. */
  value?: string | number | null;
  /** Uncontrolled starting value. */
  defaultValue?: string | number | null;
  onChange?: (value: string | null) => void;
  /** What "nothing chosen" means here, e.g. "Not recorded" or "All counties". */
  emptyLabel: string;
  /** Accessible name, for selects without a visible <label> around them. */
  label?: string;
  required?: boolean;
  disabled?: boolean;
  /** Toolbar-filter styling instead of form-field styling. */
  compact?: boolean;
  className?: string;
}) {
  const id = useId();
  const items = useMemo<Item[]>(
    () => options.map((option) => ({ value: String(option.value), label: option.label })),
    [options]
  );
  // Grouped options are listed under their headings, in order of first appearance.
  const groups = useMemo<ItemGroup[] | null>(() => {
    if (!options.some((option) => option.group)) return null;
    const byHeading = new Map<string, Item[]>();
    options.forEach((option, index) => {
      const heading = option.group ?? "";
      byHeading.set(heading, [...(byHeading.get(heading) ?? []), items[index]]);
    });
    return [...byHeading.entries()].map(([value, groupItems]) => ({ value, items: groupItems }));
  }, [options, items]);
  const find = (wanted: string | number | null | undefined) =>
    wanted === null || wanted === undefined || wanted === ""
      ? null
      : (items.find((item) => item.value === String(wanted)) ?? null);
  const controlled = value !== undefined;

  return (
    <Combobox.Root<Item>
      items={groups ?? items}
      name={name}
      required={required}
      disabled={disabled}
      autoHighlight
      {...(controlled ? { value: find(value) } : { defaultValue: find(defaultValue) })}
      onValueChange={(item) => onChange?.(item?.value ?? null)}
    >
      <div className={cn("relative", compact ? "min-w-44" : "mt-1.5", className)}>
        <Combobox.Input
          id={id}
          aria-label={label}
          placeholder={emptyLabel}
          className={cn(
            compact ? filterSelectClass : fieldClass,
            "w-full pr-14",
            !compact && "mt-0",
            compact && "placeholder:text-creaw-ink-soft"
          )}
        />
        <div className="absolute inset-y-0 right-2 flex items-center gap-0.5 text-creaw-faint">
          {!required && (
            <Combobox.Clear
              aria-label={`Clear ${label ?? "selection"}`}
              className="flex size-6 items-center justify-center rounded hover:bg-creaw-canvas"
            >
              <X size={14} aria-hidden="true" />
            </Combobox.Clear>
          )}
          <Combobox.Trigger
            aria-label={`Show ${label ?? "options"}`}
            className="flex size-6 items-center justify-center rounded hover:bg-creaw-canvas"
          >
            <ChevronDown size={16} aria-hidden="true" />
          </Combobox.Trigger>
        </div>
      </div>
      <Combobox.Portal>
        <Combobox.Positioner sideOffset={4} className="z-[70] outline-none">
          <Combobox.Popup className="max-h-72 w-[var(--anchor-width)] min-w-56 overflow-y-auto rounded-[10px] border border-creaw-line bg-white py-1 text-[14px] shadow-lg">
            <Combobox.Empty className="px-3 py-2 text-[13px] text-creaw-faint empty:hidden">
              No matches
            </Combobox.Empty>
            <Combobox.List>
              {groups
                ? (group: ItemGroup) => (
                    <Combobox.Group key={group.value} items={group.items}>
                      {group.value && (
                        <Combobox.GroupLabel className="px-3 pt-2 pb-1 text-[11.5px] font-bold uppercase tracking-[.06em] text-creaw-faint">
                          {group.value}
                        </Combobox.GroupLabel>
                      )}
                      <Combobox.Collection>{renderItem}</Combobox.Collection>
                    </Combobox.Group>
                  )
                : renderItem}
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  );
}

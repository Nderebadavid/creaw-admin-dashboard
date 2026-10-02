"use client";
import { useEffect, useState } from "react";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { loadGeographyAction, type Geography } from "@/components/portal/geography-actions";
import type { LocationQuery } from "@/lib/api/location";

// Geography changes rarely, so every filter on the page shares one load. A failed load
// is forgotten so the next filter to mount tries again.
let shared: Promise<Geography | null> | null = null;
function loadGeography() {
  shared ??= loadGeographyAction()
    .then((result) => (result.success ? result.data : null))
    .catch(() => null)
    .then((data) => {
      if (!data) shared = null;
      return data;
    });
  return shared;
}

const idOf = (value: string) => Number(value) || undefined;

/**
 * County → sub-county → ward pickers, each searchable as the user types. Choosing a level clears the levels below it, and a
 * lower level is offered only once its parent is chosen. Renders nothing until the
 * locations have loaded.
 */
export function LocationFilter({
  value,
  onChange,
}: {
  value: LocationQuery;
  /** Receives every level, unset ones as undefined, so a list filter can merge it as is. */
  onChange: (next: {
    countyId: number | undefined;
    subCountyId: number | undefined;
    wardId: number | undefined;
  }) => void;
}) {
  const [geography, setGeography] = useState<Geography | null>(null);
  useEffect(() => {
    let active = true;
    void loadGeography().then((data) => {
      if (active) setGeography(data);
    });
    return () => {
      active = false;
    };
  }, []);
  if (!geography || !geography.counties.length) return null;

  const subCounties = geography.subCounties.filter((row) => row.countyId === value.countyId);
  const wards = geography.wards.filter((row) => row.subCountyId === value.subCountyId);
  const set = (countyId?: number, subCountyId?: number, wardId?: number) =>
    onChange({ countyId, subCountyId, wardId });

  const options = (rows: readonly { id: number; name: string }[]) =>
    rows.map((row) => ({ value: row.id, label: row.name }));

  return (
    <>
      <SearchableSelect
        compact
        label="County"
        emptyLabel="All counties"
        options={options(geography.counties)}
        value={value.countyId ?? null}
        onChange={(id) => set(idOf(id ?? ""))}
      />
      {value.countyId !== undefined && subCounties.length > 0 && (
        <SearchableSelect
          compact
          label="Sub-county"
          emptyLabel="All sub-counties"
          options={options(subCounties)}
          value={value.subCountyId ?? null}
          onChange={(id) => set(value.countyId, idOf(id ?? ""))}
        />
      )}
      {value.subCountyId !== undefined && wards.length > 0 && (
        <SearchableSelect
          compact
          label="Ward"
          emptyLabel="All wards"
          options={options(wards)}
          value={value.wardId ?? null}
          onChange={(id) => set(value.countyId, value.subCountyId, idOf(id ?? ""))}
        />
      )}
    </>
  );
}

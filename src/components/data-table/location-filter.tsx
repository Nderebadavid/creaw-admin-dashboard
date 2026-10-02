"use client";
import { useEffect, useState } from "react";
import { filterSelectClass } from "@/components/ui/form-styles";
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
 * County → sub-county → ward pickers. Choosing a level clears the levels below it, and a
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

  return (
    <>
      <select
        aria-label="County"
        value={value.countyId ?? ""}
        onChange={(event) => set(idOf(event.target.value))}
        className={filterSelectClass}
      >
        <option value="">All counties</option>
        {geography.counties.map((row) => (
          <option key={row.id} value={row.id}>
            {row.name}
          </option>
        ))}
      </select>
      {value.countyId !== undefined && subCounties.length > 0 && (
        <select
          aria-label="Sub-county"
          value={value.subCountyId ?? ""}
          onChange={(event) => set(value.countyId, idOf(event.target.value))}
          className={filterSelectClass}
        >
          <option value="">All sub-counties</option>
          {subCounties.map((row) => (
            <option key={row.id} value={row.id}>
              {row.name}
            </option>
          ))}
        </select>
      )}
      {value.subCountyId !== undefined && wards.length > 0 && (
        <select
          aria-label="Ward"
          value={value.wardId ?? ""}
          onChange={(event) => set(value.countyId, value.subCountyId, idOf(event.target.value))}
          className={filterSelectClass}
        >
          <option value="">All wards</option>
          {wards.map((row) => (
            <option key={row.id} value={row.id}>
              {row.name}
            </option>
          ))}
        </select>
      )}
    </>
  );
}

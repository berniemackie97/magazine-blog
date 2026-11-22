export interface FilterState {
  publication: string;
  format: string;
  tag: string;
}

export interface Filterable {
  publication: string;
  format: string;
  tags: string[];
}

/** Empty filter values match everything. */
export function matchesFilters(item: Filterable, state: FilterState): boolean {
  return (
    (!state.publication || item.publication === state.publication) &&
    (!state.format || item.format === state.format) &&
    (!state.tag || item.tags.includes(state.tag))
  );
}

import { matchesFilters, type FilterState } from "../lib/filters";

/**
 * Wires a filter form to the list named by its `data-target`. Filter state is
 * mirrored to the query string so filtered views can be shared and survive reloads.
 */
export function initArchiveFilters(form: HTMLFormElement): void {
  const list = document.getElementById(form.dataset.target ?? "");
  const status = form.querySelector<HTMLElement>("[data-count]");
  if (!list) return;

  const items = Array.from(list.querySelectorAll<HTMLElement>("[data-filter-item]"));
  restoreFromUrl(form);

  const apply = () => {
    const state = readState(form);
    let visible = 0;
    for (const item of items) {
      const match = matchesFilters(
        {
          publication: item.dataset.publication ?? "",
          format: item.dataset.format ?? "",
          tags: (item.dataset.tags ?? "").split(",").filter(Boolean),
        },
        state,
      );
      item.hidden = !match;
      if (match) visible++;
    }
    if (status) status.textContent = `${visible} of ${items.length} articles`;
    writeToUrl(state);
  };

  form.addEventListener("change", apply);
  form.addEventListener("submit", (event) => event.preventDefault());
  apply();
}

function readState(form: HTMLFormElement): FilterState {
  const data = new FormData(form);
  const get = (key: string) => String(data.get(key) ?? "");
  return { publication: get("publication"), format: get("format"), tag: get("tag") };
}

function restoreFromUrl(form: HTMLFormElement): void {
  const params = new URLSearchParams(window.location.search);
  for (const select of form.querySelectorAll("select")) {
    const value = params.get(select.name);
    if (value && Array.from(select.options).some((o) => o.value === value)) {
      select.value = value;
    }
  }
}

function writeToUrl(state: FilterState): void {
  const url = new URL(window.location.href);
  for (const [key, value] of Object.entries(state)) {
    if (value) url.searchParams.set(key, value);
    else url.searchParams.delete(key);
  }
  window.history.replaceState(null, "", url);
}

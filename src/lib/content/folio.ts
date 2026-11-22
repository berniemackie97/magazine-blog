/** Contents, editor's letter and cover occupy the first spread. */
export const FIRST_ARTICLE_PAGE = 4;

/** Roughly two minutes of reading per printed page, plus an opener page. */
export function pagesFor(readingMinutes: number): number {
  return Math.ceil(Math.max(1, readingMinutes) / 2) + 1;
}

/**
 * Assigns each article the page it starts on, in running order, so the
 * contents list and the article's folio always agree.
 */
export function startPages<T extends { id: string; readingMinutes: number }>(
  posts: readonly T[],
): Map<string, number> {
  const pages = new Map<string, number>();
  let page = FIRST_ARTICLE_PAGE;
  for (const post of posts) {
    pages.set(post.id, page);
    page += pagesFor(post.readingMinutes);
  }
  return pages;
}

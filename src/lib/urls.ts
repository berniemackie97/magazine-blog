export const urls = {
  home: () => "/",
  issues: () => "/issues",
  issue: (publicationId: string, issueSlug: string) =>
    `/issues/${publicationId}/${issueSlug}`,
  publications: () => "/publications",
  publication: (publicationId: string) => `/publications/${publicationId}`,
  publicationFeed: (publicationId: string) =>
    `/publications/${publicationId}/rss.xml`,
  post: (postId: string) => `/posts/${postId}`,
  archive: () => "/archive",
  feed: () => "/rss.xml",
} as const;

/** True when `pathname` is `href` or a page beneath it. */
export function isActivePath(pathname: string, href: string): boolean {
  const path = pathname.replace(/\/+$/, "") || "/";
  if (href === "/") return path === "/";
  return path === href || path.startsWith(`${href}/`);
}

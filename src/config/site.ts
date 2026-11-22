export const site = {
  name: "The Rack",
  tagline: "In progress, in print.",
  description:
    "Guides, writeups, and experiments, published as virtual magazines.",
  author: "Bernie",
  locale: "en-US",
  nav: [
    { label: "Issues", href: "/issues" },
    { label: "Publications", href: "/publications" },
    { label: "Archive", href: "/archive" },
  ],
} as const;

export type NavItem = (typeof site.nav)[number];

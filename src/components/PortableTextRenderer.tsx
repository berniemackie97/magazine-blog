import React from 'react';
import { PortableText } from '@portabletext/react';
import type { PortableTextComponents } from '@portabletext/react';

const components: PortableTextComponents = {
  block: {
    normal: ({ children }) => <p className="mb-4 leading-relaxed text-lg text-neutral-100">{children}</p>,
    h2: ({ children }) => <h2 className="mt-6 mb-3 font-display text-3xl leading-snug">{children}</h2>,
    h3: ({ children }) => <h3 className="mt-5 mb-2 font-display text-2xl leading-snug">{children}</h3>,
    blockquote: ({ children }) => (
      <blockquote className="my-6 border-l-2 border-[var(--accent)] pl-4 text-xl italic text-neutral-100">
        {children}
      </blockquote>
    ),
  },
  types: {
    pullQuote: ({ value }) => (
      <figure className="my-8 rounded-md border border-[var(--rule)] bg-black/30 p-4 text-center shadow-paper">
        <div className="font-display text-2xl leading-tight text-[var(--accent)]">{value?.quote}</div>
        {value?.attribution && <figcaption className="mt-2 text-sm uppercase tracking-[0.18em] text-neutral-300">{value.attribution}</figcaption>}
      </figure>
    ),
    sidebar: ({ value }) => (
      <aside className="my-6 rounded-md border border-[var(--rule)] bg-black/40 p-4 shadow-paper">
        {value?.title && <div className="mb-2 font-display text-xl text-[var(--accent)]">{value.title}</div>}
        {value?.body ? <PortableText value={value.body} /> : null}
      </aside>
    ),
    figureBlock: ({ value }) => (
      <figure className="my-6 w-full">
        {value?.imageUrl && (
          <img src={value.imageUrl} alt={value?.alt || ''} className="w-full rounded-md border border-[var(--rule)] shadow-paper" loading="lazy" />
        )}
        {(value?.caption || value?.credit) && (
          <figcaption className="mt-2 text-sm text-neutral-300">
            {value?.caption}
            {value?.credit && <span className="ml-2 text-xs uppercase tracking-[0.18em] text-neutral-400">[{value.credit}]</span>}
          </figcaption>
        )}
      </figure>
    ),
  },
  list: {
    bullet: ({ children }) => <ul className="mb-4 list-disc pl-6 text-lg text-neutral-100">{children}</ul>,
    number: ({ children }) => <ol className="mb-4 list-decimal pl-6 text-lg text-neutral-100">{children}</ol>,
  },
  marks: {
    link: ({ children, value }) => (
      <a
        href={value?.href}
        target={value?.openInNewTab ? '_blank' : undefined}
        rel={value?.openInNewTab ? 'noreferrer' : undefined}
        className="underline decoration-[var(--accent)] decoration-2 underline-offset-4"
      >
        {children}
      </a>
    ),
    code: ({ children }) => <code className="rounded bg-black/60 px-1 py-0.5 font-mono text-sm text-[var(--accent)]">{children}</code>,
  },
};

export default function PortableTextRenderer({ value }: { value: any[] }) {
  return <PortableText value={value || []} components={components} />;
}

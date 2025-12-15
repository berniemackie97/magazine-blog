import {defineField, defineType} from 'sanity'

export default defineType({
  name: 'post',
  title: 'Post',
  type: 'document',
  fields: [
    defineField({
      name: 'slug',
      type: 'slug',
      title: 'Slug',
      options: {source: 'headline'},
      validation: Rule => Rule.required(),
    }),
    defineField({
      name: 'publication',
      type: 'reference',
      to: [{type: 'publication'}],
      validation: Rule => Rule.required(),
    }),
    defineField({
      name: 'issue',
      type: 'reference',
      to: [{type: 'issue'}],
      title: 'Issue (reference)',
    }),
    defineField({
      name: 'issueSlug',
      type: 'string',
      title: 'Issue Slug (optional fallback)',
    }),
    defineField({name: 'sectionId', type: 'string', title: 'Section ID', validation: Rule => Rule.required()}),
    defineField({
      name: 'format',
      type: 'string',
      title: 'Format',
      options: {list: ['feature', 'column', 'brief', 'field-notes', 'postmortem', 'tool-drop']},
      validation: Rule => Rule.required(),
    }),
    defineField({
      name: 'difficulty',
      type: 'string',
      title: 'Difficulty',
      options: {list: ['beginner', 'intermediate', 'advanced', 'all']},
      validation: Rule => Rule.required(),
    }),
    defineField({name: 'publishedAt', type: 'datetime', title: 'Published At', validation: Rule => Rule.required()}),
    defineField({name: 'updatedAt', type: 'datetime', title: 'Updated At'}),
    defineField({name: 'headline', type: 'string', title: 'Headline', validation: Rule => Rule.required()}),
    defineField({name: 'dek', type: 'text', rows: 2, title: 'Dek'}),
    defineField({name: 'summary', type: 'text', rows: 2, title: 'Summary'}),
    defineField({
      name: 'tags',
      type: 'array',
      of: [{type: 'string'}],
      title: 'Tags',
      options: {layout: 'tags'},
    }),
    defineField({name: 'draft', type: 'boolean', title: 'Draft', initialValue: false}),
    defineField({
      name: 'coverSlot',
      type: 'string',
      title: 'Cover Slot',
      options: {list: ['lead', 'secondary', 'brief']},
    }),
    defineField({name: 'coverPriority', type: 'number', title: 'Cover Priority'}),
    defineField({name: 'order', type: 'number', title: 'Order'}),
    defineField({name: 'coverImageUrl', type: 'url', title: 'Cover Image URL'}),
    defineField({
      name: 'coverImage',
      title: 'Cover / Hero Image',
      type: 'image',
      options: {hotspot: true},
      fields: [
        {name: 'alt', type: 'string', title: 'Alt text'},
        {name: 'credit', type: 'string', title: 'Credit'},
      ],
    }),
    defineField({
      name: 'body',
      type: 'array',
      title: 'Body',
      of: [
        {
          type: 'block',
          styles: [
            {title: 'Normal', value: 'normal'},
            {title: 'H2', value: 'h2'},
            {title: 'H3', value: 'h3'},
            {title: 'Quote', value: 'blockquote'},
          ],
          marks: {
            annotations: [
              {
                name: 'link',
                type: 'object',
                title: 'Link',
                fields: [
                  {name: 'href', type: 'url', title: 'URL'},
                  {name: 'openInNewTab', type: 'boolean', title: 'Open in new tab'},
                ],
              },
            ],
          },
        },
        {type: 'pullQuote'},
        {type: 'sidebar'},
        {type: 'figureBlock'},
      ],
    }),
  ],
  preview: {
    select: {
      title: 'headline',
      subtitle: 'publication.name',
      media: 'coverImage',
    },
  },
})

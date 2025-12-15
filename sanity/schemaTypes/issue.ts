import {defineField, defineType} from 'sanity'

export default defineType({
  name: 'issue',
  title: 'Issue',
  type: 'document',
  fields: [
    defineField({
      name: 'publication',
      type: 'reference',
      to: [{type: 'publication'}],
      validation: Rule => Rule.required(),
    }),
    defineField({name: 'issueSlug', type: 'string', title: 'Issue Slug', validation: Rule => Rule.required()}),
    defineField({name: 'displayTitle', type: 'string', title: 'Display Title', validation: Rule => Rule.required()}),
    defineField({name: 'volume', type: 'number', title: 'Volume', validation: Rule => Rule.required()}),
    defineField({name: 'number', type: 'number', title: 'Number', validation: Rule => Rule.required()}),
    defineField({name: 'date', type: 'date', title: 'Date', validation: Rule => Rule.required()}),
    defineField({name: 'theme', type: 'string', title: 'Theme', validation: Rule => Rule.required()}),
    defineField({
      name: 'status',
      type: 'string',
      title: 'Status',
      options: {list: ['open', 'locked']},
      validation: Rule => Rule.required(),
    }),
    defineField({name: 'notesFromEditor', type: 'text', title: 'Notes from Editor', rows: 3}),
    defineField({
      name: 'coverOverrides',
      title: 'Cover Overrides',
      type: 'object',
      fields: [
        {name: 'leadPostSlug', type: 'string', title: 'Lead Post Slug'},
        {
          name: 'secondaryPostSlugs',
          type: 'array',
          of: [{type: 'string'}],
          title: 'Secondary Post Slugs',
        },
      ],
    }),
  ],
  preview: {
    select: {
      title: 'displayTitle',
      subtitle: 'theme',
    },
  },
})

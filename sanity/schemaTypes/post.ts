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
      name: 'issueSlug',
      type: 'string',
      title: 'Issue Slug (optional)',
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
    defineField({name: 'tags', type: 'array', of: [{type: 'string'}], title: 'Tags'}),
    defineField({name: 'draft', type: 'boolean', title: 'Draft', initialValue: false}),
    defineField({
      name: 'coverSlot',
      type: 'string',
      title: 'Cover Slot',
      options: {list: ['lead', 'secondary', 'brief']},
    }),
    defineField({name: 'coverPriority', type: 'number', title: 'Cover Priority'}),
    defineField({
      name: 'body',
      type: 'array',
      of: [{type: 'block'}],
      title: 'Body',
    }),
  ],
  preview: {
    select: {
      title: 'headline',
      subtitle: 'publication.name',
    },
  },
})

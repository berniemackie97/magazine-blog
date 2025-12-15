import {defineField, defineType} from 'sanity'

export default defineType({
  name: 'publication',
  title: 'Publication',
  type: 'document',
  fields: [
    defineField({name: 'id', type: 'string', title: 'ID', validation: Rule => Rule.required()}),
    defineField({name: 'name', type: 'string', title: 'Name', validation: Rule => Rule.required()}),
    defineField({name: 'description', type: 'text', rows: 3, title: 'Description'}),
    defineField({name: 'accent', type: 'string', title: 'Accent Color (hex)' }),
    defineField({name: 'displayFont', type: 'string', title: 'Display Font class'}),
    defineField({
      name: 'sections',
      title: 'Sections',
      type: 'array',
      of: [
        {
          type: 'object',
          fields: [
            {name: 'id', type: 'string', title: 'ID'},
            {name: 'label', type: 'string', title: 'Label'},
          ],
        },
      ],
    }),
    defineField({name: 'isFeatured', type: 'boolean', title: 'Featured', initialValue: false}),
  ],
  preview: {
    select: {title: 'name', subtitle: 'id'},
  },
})

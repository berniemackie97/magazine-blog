import {defineType, defineField} from 'sanity'

export default defineType({
  name: 'pullQuote',
  title: 'Pull Quote',
  type: 'object',
  fields: [
    defineField({name: 'quote', type: 'text', rows: 3, title: 'Quote', validation: Rule => Rule.required()}),
    defineField({name: 'attribution', type: 'string', title: 'Attribution'}),
  ],
  preview: {
    select: {title: 'quote', subtitle: 'attribution'},
  },
})

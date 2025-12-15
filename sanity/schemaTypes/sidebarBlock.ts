import {defineType, defineField} from 'sanity'

export default defineType({
  name: 'sidebar',
  title: 'Sidebar',
  type: 'object',
  fields: [
    defineField({name: 'title', type: 'string', title: 'Title'}),
    defineField({
      name: 'body',
      type: 'array',
      title: 'Body',
      of: [{type: 'block'}],
    }),
    defineField({name: 'tone', type: 'string', title: 'Tone', options: {list: ['note', 'alert', 'tip']}}),
  ],
  preview: {
    select: {title: 'title'},
    prepare({title}) {
      return {title: title || 'Sidebar'};
    },
  },
})

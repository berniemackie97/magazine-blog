import {defineType, defineField} from 'sanity'

export default defineType({
  name: 'figureBlock',
  title: 'Figure',
  type: 'object',
  fields: [
    defineField({name: 'imageUrl', type: 'url', title: 'Image URL', validation: Rule => Rule.required()}),
    defineField({name: 'alt', type: 'string', title: 'Alt text'}),
    defineField({name: 'caption', type: 'string', title: 'Caption'}),
    defineField({name: 'credit', type: 'string', title: 'Credit'}),
  ],
  preview: {
    select: {title: 'caption', subtitle: 'credit', media: 'image'},
  },
})

import {defineField, defineType} from 'sanity'

export default defineType({
  name: 'publication',
  title: 'Publication',
  type: 'document',
  fields: [
    defineField({name: 'id', type: 'string', title: 'ID', validation: Rule => Rule.required()}),
    defineField({name: 'name', type: 'string', title: 'Name', validation: Rule => Rule.required()}),
    defineField({name: 'description', type: 'text', rows: 3, title: 'Description'}),
    defineField({name: 'accent', type: 'string', title: 'Accent Color (hex)', validation: Rule => Rule.regex(/^#/, {name: 'hex color'}) }),
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
    defineField({
      name: 'coverImage',
      title: 'Cover Image',
      type: 'image',
      options: {hotspot: true},
      fields: [{name: 'alt', type: 'string', title: 'Alt text'}],
    }),
    defineField({
      name: 'defaultCoverSpec',
      title: 'Default Cover Specification',
      type: 'coverSpec',
      description: 'Brand template applied to all issues unless overridden at the issue level',
    }),
    defineField({
      name: 'pageTheme',
      title: 'Page Theme',
      type: 'object',
      description: 'Visual theme applied to issue and post pages for this publication',
      fields: [
        {name: 'template', type: 'string', title: 'Template', options: {list: ['tech-mono', 'field-notes', 'zine-punk', 'bold-pop', 'minimal-ink', 'retro-print', 'classic']}},
        {name: 'background', type: 'string', title: 'Background Color', description: 'Page background (hex)'},
        {name: 'surface', type: 'string', title: 'Surface Color', description: 'Card/raised element background (hex)'},
        {name: 'text', type: 'string', title: 'Text Color', description: 'Primary text color (hex)'},
        {name: 'textMuted', type: 'string', title: 'Muted Text Color', description: 'Secondary text color (hex)'},
        {name: 'accent', type: 'string', title: 'Accent Color', description: 'Primary accent color (hex)'},
        {name: 'accentAlt', type: 'string', title: 'Alt Accent Color', description: 'Secondary accent color (hex)'},
        {name: 'border', type: 'string', title: 'Border Color', description: 'Border color (hex)'},
        {name: 'headingFont', type: 'string', title: 'Heading Font', options: {list: ['display', 'hand', 'mono', 'body']}},
        {name: 'bodyFont', type: 'string', title: 'Body Font', options: {list: ['body', 'mono']}},
      ],
    }),
  ],
  preview: {
    select: {title: 'name', subtitle: 'id', media: 'coverImage'},
  },
})

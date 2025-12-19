import {defineType, defineField} from 'sanity'

// Cover Theme - colors and visual properties
export const coverTheme = defineType({
  name: 'coverTheme',
  title: 'Cover Theme',
  type: 'object',
  fields: [
    defineField({
      name: 'paper',
      type: 'string',
      title: 'Paper Color',
      description: 'Background color (hex, e.g. #f7f1e6)',
    }),
    defineField({
      name: 'ink',
      type: 'string',
      title: 'Ink Color',
      description: 'Text color (hex)',
    }),
    defineField({
      name: 'accent',
      type: 'string',
      title: 'Accent Color',
      description: 'Primary accent color (hex)',
    }),
    defineField({
      name: 'alt',
      type: 'string',
      title: 'Alt Color',
      description: 'Secondary accent color (hex)',
    }),
    defineField({
      name: 'photo',
      type: 'string',
      title: 'Photo/Pattern',
      description: 'CSS gradient or url() for background art',
    }),
    defineField({
      name: 'tilt',
      type: 'string',
      title: 'Tilt Angle',
      description: 'CSS rotation, e.g. "-1.25deg"',
    }),
  ],
})

// Cover Layout - CSS Grid configuration
export const coverLayout = defineType({
  name: 'coverLayout',
  title: 'Cover Layout',
  type: 'object',
  fields: [
    defineField({
      name: 'cols',
      type: 'string',
      title: 'Grid Columns',
      description: 'CSS grid-template-columns (e.g. "30px 1fr")',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'rows',
      type: 'string',
      title: 'Grid Rows',
      description: 'CSS grid-template-rows (optional)',
    }),
    defineField({
      name: 'areas',
      type: 'array',
      of: [{type: 'string'}],
      title: 'Grid Areas',
      description: 'Each string is a row of grid-template-areas',
    }),
    defineField({
      name: 'gap',
      type: 'string',
      title: 'Gap',
      description: 'CSS gap value (e.g. "0.75rem")',
    }),
    defineField({
      name: 'pad',
      type: 'string',
      title: 'Padding',
      description: 'CSS padding (e.g. "12px 12px 12px 42px")',
    }),
    defineField({
      name: 'minHeight',
      type: 'number',
      title: 'Minimum Height',
      description: 'In pixels',
    }),
  ],
})

// Feature item for feature lists
export const coverFeatureItem = defineType({
  name: 'coverFeatureItem',
  title: 'Feature Item',
  type: 'object',
  fields: [
    defineField({
      name: 'no',
      type: 'string',
      title: 'Number/Bullet',
      description: 'e.g. "01" or bullet character',
    }),
    defineField({
      name: 'text',
      type: 'string',
      title: 'Text',
      validation: (Rule) => Rule.required(),
    }),
  ],
  preview: {
    select: {title: 'text', subtitle: 'no'},
  },
})

// Cover Block - individual elements on the cover
export const coverBlock = defineType({
  name: 'coverBlock',
  title: 'Cover Block',
  type: 'object',
  fields: [
    defineField({
      name: 'id',
      type: 'string',
      title: 'Block ID',
      description: 'Unique identifier for this block',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'type',
      type: 'string',
      title: 'Block Type',
      options: {
        list: [
          {title: 'Masthead', value: 'masthead'},
          {title: 'Title', value: 'title'},
          {title: 'Meta', value: 'meta'},
          {title: 'Art', value: 'art'},
          {title: 'Feature List', value: 'featureList'},
          {title: 'Sticker', value: 'sticker'},
          {title: 'Barcode', value: 'barcode'},
          {title: 'CTA', value: 'cta'},
          {title: 'Spine', value: 'spine'},
        ],
      },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'area',
      type: 'string',
      title: 'Grid Area',
      description: 'CSS grid-area name',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'tone',
      type: 'string',
      title: 'Tone',
      options: {
        list: [
          {title: 'Paper', value: 'paper'},
          {title: 'Ink', value: 'ink'},
          {title: 'Muted', value: 'muted'},
          {title: 'Accent', value: 'accent'},
        ],
      },
    }),
    defineField({
      name: 'rotate',
      type: 'number',
      title: 'Rotation',
      description: 'Degrees to rotate this block',
    }),
    defineField({
      name: 'align',
      type: 'string',
      title: 'Alignment',
      options: {
        list: [
          {title: 'Start', value: 'start'},
          {title: 'Center', value: 'center'},
          {title: 'End', value: 'end'},
        ],
      },
    }),
    defineField({
      name: 'hidden',
      type: 'boolean',
      title: 'Hidden',
      description: 'Hide this block',
    }),
    // Type-specific fields
    defineField({
      name: 'publicationName',
      type: 'string',
      title: 'Publication Name',
      description: 'For masthead blocks (leave empty to use publication name)',
      hidden: ({parent}) => parent?.type !== 'masthead',
    }),
    defineField({
      name: 'statusText',
      type: 'string',
      title: 'Status Text',
      description: 'For masthead blocks (e.g. "Open", "Locked")',
      hidden: ({parent}) => parent?.type !== 'masthead',
    }),
    defineField({
      name: 'title',
      type: 'string',
      title: 'Title',
      description: 'For title blocks (leave empty to use issue title)',
      hidden: ({parent}) => parent?.type !== 'title',
    }),
    defineField({
      name: 'dek',
      type: 'string',
      title: 'Dek/Subtitle',
      description: 'For title blocks',
      hidden: ({parent}) => parent?.type !== 'title',
    }),
    defineField({
      name: 'left',
      type: 'string',
      title: 'Left Text',
      description: 'For meta blocks (leave empty for Vol/No)',
      hidden: ({parent}) => parent?.type !== 'meta',
    }),
    defineField({
      name: 'right',
      type: 'string',
      title: 'Right Text',
      description: 'For meta blocks (leave empty for date)',
      hidden: ({parent}) => parent?.type !== 'meta',
    }),
    defineField({
      name: 'price',
      type: 'string',
      title: 'Price',
      description: 'For meta blocks (e.g. "$4.99" or "FREE")',
      hidden: ({parent}) => parent?.type !== 'meta',
    }),
    defineField({
      name: 'background',
      type: 'string',
      title: 'Background',
      description: 'CSS background for art blocks (gradient or url)',
      hidden: ({parent}) => parent?.type !== 'art',
    }),
    defineField({
      name: 'heading',
      type: 'string',
      title: 'Heading',
      description: 'For featureList blocks (e.g. "Inside")',
      hidden: ({parent}) => parent?.type !== 'featureList',
    }),
    defineField({
      name: 'hint',
      type: 'string',
      title: 'Hint',
      description: 'For featureList blocks (right-side text)',
      hidden: ({parent}) => parent?.type !== 'featureList',
    }),
    defineField({
      name: 'items',
      type: 'array',
      of: [{type: 'coverFeatureItem'}],
      title: 'Feature Items',
      description: 'For featureList blocks',
      hidden: ({parent}) => parent?.type !== 'featureList',
    }),
    defineField({
      name: 'big',
      type: 'string',
      title: 'Big Text',
      description: 'For sticker blocks (main text)',
      hidden: ({parent}) => parent?.type !== 'sticker',
    }),
    defineField({
      name: 'small',
      type: 'string',
      title: 'Small Text',
      description: 'For sticker blocks (sub text)',
      hidden: ({parent}) => parent?.type !== 'sticker',
    }),
    defineField({
      name: 'text',
      type: 'string',
      title: 'Text',
      description: 'For cta and spine blocks',
      hidden: ({parent}) => parent?.type !== 'cta' && parent?.type !== 'spine',
    }),
  ],
  preview: {
    select: {
      type: 'type',
      area: 'area',
      title: 'title',
      text: 'text',
      big: 'big',
    },
    prepare({type, area, title, text, big}) {
      const displayText = title || text || big || ''
      return {
        title: `${type} (${area})`,
        subtitle: displayText,
      }
    },
  },
})

// Full Cover Spec
export const coverSpec = defineType({
  name: 'coverSpec',
  title: 'Cover Specification',
  type: 'object',
  fields: [
    defineField({
      name: 'template',
      type: 'string',
      title: 'Template',
      description: 'Base template style',
      options: {
        list: [
          {title: 'Bold Pop', value: 'bold-pop'},
          {title: 'Zine Punk', value: 'zine-punk'},
          {title: 'Field Notes', value: 'field-notes'},
          {title: 'Tech Mono', value: 'tech-mono'},
          {title: 'Retro Print', value: 'retro-print'},
          {title: 'Minimal Ink', value: 'minimal-ink'},
          {title: 'Classic', value: 'classic'},
        ],
      },
      initialValue: 'bold-pop',
    }),
    defineField({
      name: 'theme',
      type: 'coverTheme',
      title: 'Theme',
      description: 'Override template colors',
    }),
    defineField({
      name: 'layout',
      type: 'coverLayout',
      title: 'Layout',
      description: 'Override template grid layout',
    }),
    defineField({
      name: 'blocks',
      type: 'array',
      of: [{type: 'coverBlock'}],
      title: 'Blocks',
      description: 'Cover elements (leave empty for template defaults)',
    }),
  ],
})

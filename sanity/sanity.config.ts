import {
  defineConfig,
  type DocumentActionComponent,
  type DocumentActionsResolver,
  type DocumentBadgesResolver,
} from 'sanity'
import {structureTool} from 'sanity/structure'
import {visionTool} from '@sanity/vision'
import {schemaTypes} from './schemaTypes'

const previewBase = process.env.SANITY_STUDIO_PREVIEW_BASE || 'https://magazine-blog-chi.vercel.app/preview'

const previewActions: DocumentActionsResolver = (prev, context) => {
  if (context.schemaType !== 'post') return prev
  const PreviewAction: DocumentActionComponent = (props) => {
    const slug = props.draft?.slug?.current || props.published?.slug?.current
    return {
      ...props,
      label: 'Open preview',
      onHandle: () => {
        if (slug) {
          window.open(`${previewBase}/${slug}`, '_blank')
        } else {
          alert('Add a slug before previewing.')
        }
        props.onComplete()
      },
    }
  }
  return [...prev, PreviewAction]
}

const previewBadges: DocumentBadgesResolver = (prev, context) => {
  if (context.schemaType !== 'post') return prev
  const slug = context.draft?.slug?.current || context.published?.slug?.current
  if (!slug) return prev
  return [
    ...prev,
    {
      label: 'Preview',
      color: 'success',
      title: 'Open preview (drafts visible)',
      onClick: () => {
        window.open(`${previewBase}/${slug}`, '_blank')
      },
    },
  ]
}

export default defineConfig({
  name: 'default',
  title: 'magazine-blog',

  projectId: 'i1ny245v',
  dataset: 'production',

  plugins: [structureTool(), visionTool()],

  document: {
    actions: previewActions,
    badges: previewBadges,
  },

  schema: {
    types: schemaTypes,
  },
})

import {defineConfig, type DocumentActionComponent} from 'sanity'
import {structureTool} from 'sanity/structure'
import {visionTool} from '@sanity/vision'
import {schemaTypes} from './schemaTypes'

export default defineConfig({
  name: 'default',
  title: 'magazine-blog',

  projectId: 'i1ny245v',
  dataset: 'production',

  plugins: [structureTool(), visionTool()],

  document: {
    actions: (prev, context) => {
      if (context.schemaType !== 'post') return prev;
      const PreviewAction: DocumentActionComponent = (props) => {
        const slug = props.draft?.slug?.current || props.published?.slug?.current;
        const base = 'http://localhost:4321/preview';
        return {
          ...props,
          label: 'Open preview',
          onHandle: () => {
            if (slug) {
              window.open(`${base}/${slug}`, '_blank');
            } else {
              alert('Add a slug before previewing.');
            }
            props.onComplete();
          },
        };
      };
      return [...prev, PreviewAction];
    },
    badges: (prev, context) => {
      if (context.schemaType !== 'post') return prev;
      const slug = context.draft?.slug?.current || context.published?.slug?.current;
      if (!slug) return prev;
      const base = 'http://localhost:4321/preview';
      return [
        ...prev,
        {
          label: 'Preview',
          color: 'success',
          title: 'Open preview (drafts visible)',
          onClick: () => {
            window.open(`${base}/${slug}`, '_blank');
          },
        },
      ];
    },
  },

  schema: {
    types: schemaTypes,
  },
})

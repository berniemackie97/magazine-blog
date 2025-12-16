import {defineCliConfig} from 'sanity/cli'

export default defineCliConfig({
  api: {
    projectId: 'i1ny245v',
    dataset: 'production'
  },
  deployment: {
    appId: 'xkl5rga67e7c6rs0cvzgayam',
    /**
     * Enable auto-updates for studios.
     * Learn more at https://www.sanity.io/docs/cli#auto-updates
     */
    autoUpdates: true,
  }
})

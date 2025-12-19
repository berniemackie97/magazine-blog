import publication from './publication'
import issue from './issue'
import post from './post'
import pullQuote from './pullQuoteBlock'
import sidebar from './sidebarBlock'
import figureBlock from './figureBlock'
import {coverTheme, coverLayout, coverFeatureItem, coverBlock, coverSpec} from './coverSpec'

export const schemaTypes = [
  // Cover spec types (must be before documents that reference them)
  coverTheme,
  coverLayout,
  coverFeatureItem,
  coverBlock,
  coverSpec,
  // Document types
  publication,
  issue,
  post,
  // Block types
  pullQuote,
  sidebar,
  figureBlock,
]

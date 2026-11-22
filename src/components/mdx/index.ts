import Callout from "./Callout.astro";
import CaptionedFigure from "./CaptionedFigure.astro";
import CaptionedVideo from "./CaptionedVideo.astro";
import CollapsibleSection from "./CollapsibleSection.astro";
import PullQuote from "./PullQuote.astro";
import ResourceCard from "./ResourceCard.astro";
import ResourceGrid from "./ResourceGrid.astro";

/** Components available to every MDX article without an import. */
export const mdxComponents = {
  Callout,
  CaptionedFigure,
  CaptionedVideo,
  CollapsibleSection,
  PullQuote,
  ResourceCard,
  ResourceGrid,
};

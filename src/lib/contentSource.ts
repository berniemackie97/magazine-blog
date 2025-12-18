import { client } from "./cmsClient";
import * as cms from "./cmsData";
import * as local from "./data";

export const useCms = Boolean(client);

type ContentSource = {
  getPublications: typeof local.getPublications;
  getFeaturedPublications: typeof local.getFeaturedPublications;
  getPublication: typeof local.getPublication;
  getIssue: typeof local.getIssue;
  getIssuesForPublication: typeof local.getIssuesForPublication;
  getPostsForIssue: typeof local.getPostsForIssue;
  getLatestLockedIssueForPublication: typeof local.getLatestLockedIssueForPublication;
  getLatestIssues: typeof local.getLatestIssues;
  getLatestPosts: typeof local.getLatestPosts;
  getPostsByPublication: typeof local.getPostsByPublication;
  getPostBySlug: typeof local.getPostBySlug;
};

const source: ContentSource = useCms ? cms : local;

export const getPublications = source.getPublications;
export const getFeaturedPublications = source.getFeaturedPublications;
export const getPublication = source.getPublication;
export const getIssue = source.getIssue;
export const getIssuesForPublication = source.getIssuesForPublication;
export const getPostsForIssue = source.getPostsForIssue;
export const getLatestLockedIssueForPublication =
  source.getLatestLockedIssueForPublication;
export const getLatestIssues = source.getLatestIssues;
export const getLatestPosts = source.getLatestPosts;
export const getPostsByPublication = source.getPostsByPublication;
export const getPostBySlug = source.getPostBySlug;

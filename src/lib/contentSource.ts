import { client } from './cmsClient';
import * as cms from './cmsData';
import * as local from './data';

const useCms = !!client;

export { useCms };

export const getPublication = (id: string): any => (useCms ? cms.getPublication(id) : local.getPublication(id));
export const getIssue = (publicationId: string, issueSlug: string): any =>
  useCms ? cms.getIssue(publicationId, issueSlug) : local.getIssue(publicationId, issueSlug);
export const getIssuesForPublication = (publicationId: string): any =>
  useCms ? cms.getIssuesForPublication(publicationId) : local.getIssuesForPublication(publicationId);
export const getPostsForIssue = (publicationId: string, issueSlug: string): any =>
  useCms ? cms.getPostsForIssue(publicationId, issueSlug) : local.getPostsForIssue(publicationId, issueSlug);
export const getLatestLockedIssueForPublication = (publicationId: string): any =>
  useCms ? cms.getLatestLockedIssueForPublication(publicationId) : local.getLatestLockedIssueForPublication(publicationId);
export const getLatestIssues = (limit?: number): any => (useCms ? cms.getLatestIssues(limit) : local.getLatestIssues(limit));
export const getLatestPosts = (limit?: number): any => (useCms ? cms.getLatestPosts(limit) : local.getLatestPosts(limit));
export const getPostsByPublication = (publicationId: string): any =>
  useCms ? cms.getPostsByPublication(publicationId) : local.getPostsByPublication(publicationId);
export const getPostBySlug = (slug: string): any => (useCms ? cms.getPostBySlug(slug) : local.getPostBySlug(slug));

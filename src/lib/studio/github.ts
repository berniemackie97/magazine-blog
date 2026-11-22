import { StudioError } from "./content";
export const repository = () =>
  process.env.CMS_REPOSITORY || "berniemackie97/magazine-blog";
export const baseBranch = () => process.env.CMS_BASE_BRANCH || "main";
export const editorialBranch = "cms/editorial";
export class GitHub {
  constructor(private token: string) {}
  async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await fetch(`https://api.github.com${path}`, {
      ...init,
      signal: AbortSignal.timeout(20_000),
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${this.token}`,
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
        ...init.headers,
      },
    });
    if (!response.ok) {
      const status = response.status;
      if (status === 401)
        throw new StudioError(401, "GitHub access expired. Sign in again.");
      if (status === 404)
        throw new StudioError(
          404,
          "The requested GitHub resource was not found.",
        );
      if (status === 409 || status === 422)
        throw new StudioError(
          409,
          "GitHub rejected the update. Refresh the workspace and check for conflicts or branch protection requirements.",
        );
      if (status === 403 || status === 429)
        throw new StudioError(
          503,
          "GitHub access is restricted or rate limited. Check repository permissions and try again later.",
        );
      throw new StudioError(
        502,
        "GitHub could not complete the request. Your saved content is unchanged.",
      );
    }
    return (response.status === 204 ? undefined : await response.json()) as T;
  }
  repo<T>(path: string, init: RequestInit = {}): Promise<T> {
    return this.request(`/repos/${repository()}${path}`, init);
  }
}

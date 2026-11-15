import { Octokit } from '@octokit/rest';
import { env, githubAppConfigured } from '../config/env';
import { createInstallationOctokit } from './app-auth';

/**
 * Octokit factory used by the workers.
 *
 * Prefers GitHub App installation auth when an `installationId` is available and
 * the App is configured; otherwise falls back to the static PAT (`GITHUB_TOKEN`).
 * The fallback keeps local/dev and PAT-only setups working while the App is being
 * rolled out.
 */

let patOctokit: Octokit | null = null;

export function getOctokit(installationId?: number): Octokit {
  if (installationId !== undefined && githubAppConfigured) {
    return createInstallationOctokit(installationId);
  }

  const token = env.githubToken?.trim();
  if (token && token.length > 20 && !token.includes('your_token') && !token.includes('ghp_...')) {
    if (!patOctokit) patOctokit = new Octokit({ auth: token });
    return patOctokit;
  }

  // Unauthenticated fallback: Allows indexing any public repository without credentials
  return new Octokit();
}

/** Public "Install CORTEX" URL for the GitHub App repo picker. */
export function getInstallUrl(): string | null {
  return env.githubAppSlug ? `https://github.com/apps/${env.githubAppSlug}/installations/new` : null;
}

/** All repos accessible to an installation (paginated). */
export async function listInstallationRepos(
  installationId: number,
): Promise<Array<{ owner: string; name: string }>> {
  const octokit = createInstallationOctokit(installationId);
  const repos = await octokit.paginate(octokit.rest.apps.listReposAccessibleToInstallation, {
    per_page: 100,
  });
  return repos.map((r) => ({ owner: r.owner?.login ?? '', name: r.name })).filter((r) => r.owner);
}

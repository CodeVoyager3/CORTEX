import { createAppAuth } from '@octokit/auth-app';
import { Octokit } from '@octokit/rest';
import { env, assertPresent, githubAppConfigured } from '../config/env';

/**
 * GitHub App authentication.
 *
 * A GitHub App authenticates in two modes:
 *  - As the App itself (a JWT signed with the private key) — for app-level calls
 *    such as listing installations.
 *  - As an installation (a short-lived installation access token, auto-minted and
 *    refreshed by `createAppAuth`) — for acting on the repos a user granted access
 *    to: downloading zipballs, fetching PR diffs, posting comments.
 *
 * Workers use the installation mode with the `installation.id` carried on each
 * webhook event, so no long-lived PAT is needed in production.
 */

function requireAppConfig(): { appId: string; privateKey: string } {
  if (!githubAppConfigured) {
    throw new Error(
      '[github] GitHub App is not configured. Set GITHUB_APP_ID and GITHUB_APP_PRIVATE_KEY.',
    );
  }
  return {
    appId: assertPresent(env.githubAppId, 'GITHUB_APP_ID'),
    privateKey: assertPresent(env.githubAppPrivateKey, 'GITHUB_APP_PRIVATE_KEY'),
  };
}

/** Octokit authenticated as the App (JWT). */
export function createAppOctokit(): Octokit {
  const { appId, privateKey } = requireAppConfig();
  return new Octokit({ authStrategy: createAppAuth, auth: { appId, privateKey } });
}

/** Octokit authenticated as a specific installation (installation access token). */
export function createInstallationOctokit(installationId: number): Octokit {
  const { appId, privateKey } = requireAppConfig();
  return new Octokit({
    authStrategy: createAppAuth,
    auth: { appId, privateKey, installationId },
  });
}

import type { Request, Response } from 'express';
import { getInstallUrl } from '../../../package/github/client';
import { githubAppConfigured } from '../../../package/config/env';

/**
 * GET /api/install-url — the GitHub App "Install CORTEX" link the dashboard
 * sends users to. Returns configured:false when the App env vars are absent
 * (e.g. local dev on the PAT fallback), so the client can hide the button.
 */
export function getInstall(_req: Request, res: Response): void {
  const installUrl = getInstallUrl();
  res.json({ configured: githubAppConfigured && Boolean(installUrl), installUrl });
}

import { Worker, type Job } from 'bullmq';
import { QUEUE_NAMES, createRedisConnection, type ReviewJobData } from '../../../package/queue';
import { getOctokit } from '../../../package/github/client';
import { upsertRepository } from '../../../package/db/prisma';
import { reviewService } from '../services/review.service';

const connection = createRedisConnection(true);

export const reviewWorker = new Worker<ReviewJobData>(
  QUEUE_NAMES.review,
  async (job: Job<ReviewJobData>) => {
    console.log(`[Review Worker] Picked up job #${job.id}: ${job.name}`);

    const { owner, repo: repoName, prNumber, installationId } = job.data;
    console.log(`[Review Worker] Processing PR #${prNumber} for ${owner}/${repoName}`);

    const octokit = getOctokit(installationId);
    const repo = await upsertRepository(owner, repoName);

    let diffText: string;
    try {
      const diffResponse = await octokit.rest.pulls.get({
        owner,
        repo: repoName,
        pull_number: prNumber,
        mediaType: { format: 'diff' },
      });
      diffText = diffResponse.data as unknown as string;
    } catch (err) {
      throw new Error(`Failed to fetch PR diff: ${(err as Error).message}`);
    }

    if (!diffText) {
      console.log(`[Review Worker] PR #${prNumber} has no diff to review. Skipping.`);
      return;
    }

    const result = await reviewService.reviewPullRequest(repo.id, prNumber, diffText);

    if (result.status !== 'completed' || !result.commentBody) {
      console.warn(`[Review Worker] Skipping GitHub comment — review status=${result.status}`);
      return;
    }

    await octokit.rest.issues.createComment({
      owner,
      repo: repoName,
      issue_number: prNumber,
      body: result.commentBody,
    });

    console.log(`[Review Worker] Posted CORTEX comment on PR #${prNumber}`);
  },
  { connection },
);

reviewWorker.on('completed', (job) => {
  console.log(`[Review Worker] Job #${job.id} completed successfully`);
});

reviewWorker.on('failed', (job, err) => {
  console.error(`[Review Worker] Job #${job?.id} failed: ${err.message}`);
});

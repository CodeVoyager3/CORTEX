import { Router } from 'express';
import { getStats } from '../controllers/stats.controller';
import { listRepos, getRepo, indexRepo, deleteRepo } from '../controllers/repos.controller';
import { listReviews, getReview, createReview } from '../controllers/reviews.controller';
import { getInstall } from '../controllers/install.controller';
import { getHealth } from '../controllers/health.controller';
import { getJob } from '../controllers/jobs.controller';
import { chat } from '../controllers/chat.controller';
import { getDependencies } from '../controllers/dependencies.controller';

export const apiRouter = Router();

// System
apiRouter.get('/health', getHealth);
apiRouter.get('/stats', getStats);
apiRouter.get('/install-url', getInstall);

// Repositories: list / dashboard-triggered indexing / detail / delete
apiRouter.get('/repos', listRepos);
apiRouter.post('/repos/index', indexRepo);
apiRouter.get('/repos/:id', getRepo);
apiRouter.delete('/repos/:id', deleteRepo);

// PR reviews: history / detail / dashboard-triggered review
apiRouter.get('/reviews', listReviews);
apiRouter.post('/reviews', createReview);
apiRouter.get('/reviews/:id', getReview);

// Background job status (rag | review), codebase chat, dependency lookup
apiRouter.get('/jobs/:queue/:id', getJob);
apiRouter.post('/chat', chat);
apiRouter.get('/dependencies', getDependencies);

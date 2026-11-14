import 'dotenv/config';
import './workers/rag.worker';
import './workers/review.worker';

console.log('Worker Service is active and waiting for queue jobs...');
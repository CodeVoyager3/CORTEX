import express from 'express';
import cors from 'cors';
import { env } from '../../package/config/env';
import { apiRouter } from './routes';

const app = express();

app.use(cors());
app.use(express.json());
app.use('/api', apiRouter);

app.listen(env.apiPort, () => {
  console.log(`[API Service] Running on http://localhost:${env.apiPort}`);
});

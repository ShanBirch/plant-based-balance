import { withLambda } from '@netlify/aws-lambda-compat';
import legacy from '../functions/scheduled-coach-reply-worker.js';

export default withLambda(legacy.handler);

import { withLambda } from '@netlify/aws-lambda-compat';
import legacy from '../functions/ig-media-retry-worker.js';

export default withLambda(legacy.handler);

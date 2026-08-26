import { withLambda } from '@netlify/aws-lambda-compat';
import legacy from '../functions/sync-wearable-data.js';

export default withLambda(legacy.handler);

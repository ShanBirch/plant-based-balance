import { withLambda } from '@netlify/aws-lambda-compat';
import legacy from '../functions/sync-fitbit-data.js';

export default withLambda(legacy.handler);

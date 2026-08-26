import { withLambda } from '@netlify/aws-lambda-compat';
import legacy from '../functions/meta-ig-sync-content.js';

export default withLambda(legacy.handler);

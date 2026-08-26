import { withLambda } from '@netlify/aws-lambda-compat';
import legacy from '../functions/meta-ig-webhook.js';

export default withLambda(legacy.handler);

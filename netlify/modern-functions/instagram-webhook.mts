import { withLambda } from '@netlify/aws-lambda-compat';
import legacy from '../functions/instagram-webhook.js';

export default withLambda(legacy.handler);

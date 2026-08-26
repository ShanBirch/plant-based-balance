import { withLambda } from '@netlify/aws-lambda-compat';
import legacy from '../functions/auto-feed-comment.js';

export default withLambda(legacy.handler);

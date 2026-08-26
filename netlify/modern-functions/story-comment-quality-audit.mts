import { withLambda } from '@netlify/aws-lambda-compat';
import legacy from '../functions/story-comment-quality-audit.js';

export default withLambda(legacy.handler);

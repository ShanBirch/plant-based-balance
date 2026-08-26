import { withLambda } from '@netlify/aws-lambda-compat';
import legacy from '../functions/meta-preview-feed.js';

export default withLambda(legacy.handler);

import { withLambda } from '@netlify/aws-lambda-compat';
import legacy from '../functions/widget-coach-feed.js';

export default withLambda(legacy.handler);

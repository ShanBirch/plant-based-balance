import { withLambda } from '@netlify/aws-lambda-compat';
import legacy from '../functions/coach-uncontacted-feed.js';

export default withLambda(legacy.handler);

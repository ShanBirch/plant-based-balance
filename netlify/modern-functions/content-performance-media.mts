import { withLambda } from '@netlify/aws-lambda-compat';
import legacy from '../functions/content-performance-media.js';

export default withLambda(legacy.handler);

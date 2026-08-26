import { withLambda } from '@netlify/aws-lambda-compat';
import legacy from '../functions/content-performance-snapshot.js';

export default withLambda(legacy.handler);

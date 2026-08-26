import { withLambda } from '@netlify/aws-lambda-compat';
import legacy from '../functions/extract-ig-thread-memory.js';

export default withLambda(legacy.handler);

import { withLambda } from '@netlify/aws-lambda-compat';
import legacy from '../functions/extract-client-memory.js';

export default withLambda(legacy.handler);

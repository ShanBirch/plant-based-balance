import { withLambda } from '@netlify/aws-lambda-compat';
import legacy from '../functions/approve-ig-dispatch-batch.js';

export default withLambda(legacy.handler);

import { withLambda } from '@netlify/aws-lambda-compat';
import legacy from '../functions/cancel-coach-reply.js';

export default withLambda(legacy.handler);

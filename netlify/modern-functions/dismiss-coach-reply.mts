import { withLambda } from '@netlify/aws-lambda-compat';
import legacy from '../functions/dismiss-coach-reply.js';

export default withLambda(legacy.handler);

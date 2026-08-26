import { withLambda } from '@netlify/aws-lambda-compat';
import legacy from '../functions/schedule-coach-reply.js';

export default withLambda(legacy.handler);

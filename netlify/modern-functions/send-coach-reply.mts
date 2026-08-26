import { withLambda } from '@netlify/aws-lambda-compat';
import legacy from '../functions/send-coach-reply.js';

export default withLambda(legacy.handler);

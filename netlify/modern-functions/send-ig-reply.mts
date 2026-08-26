import { withLambda } from '@netlify/aws-lambda-compat';
import legacy from '../functions/send-ig-reply.js';

export default withLambda(legacy.handler);

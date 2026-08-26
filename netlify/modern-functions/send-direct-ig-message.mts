import { withLambda } from '@netlify/aws-lambda-compat';
import legacy from '../functions/send-direct-ig-message.js';

export default withLambda(legacy.handler);

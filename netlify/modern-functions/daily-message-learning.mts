import { withLambda } from '@netlify/aws-lambda-compat';
import legacy from '../functions/daily-message-learning.js';

export default withLambda(legacy.handler);

import { withLambda } from '@netlify/aws-lambda-compat';
import legacy from '../functions/pulse-evening.js';

export default withLambda(legacy.handler);

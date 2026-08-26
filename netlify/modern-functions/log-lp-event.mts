import { withLambda } from '@netlify/aws-lambda-compat';
import legacy from '../functions/log-lp-event.js';

export default withLambda(legacy.handler);

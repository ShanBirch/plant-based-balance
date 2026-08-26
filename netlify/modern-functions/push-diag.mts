import { withLambda } from '@netlify/aws-lambda-compat';
import legacy from '../functions/push-diag.js';

export default withLambda(legacy.handler);

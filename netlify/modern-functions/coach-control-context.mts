import { withLambda } from '@netlify/aws-lambda-compat';
import legacy from '../functions/coach-control-context.js';

export default withLambda(legacy.handler);

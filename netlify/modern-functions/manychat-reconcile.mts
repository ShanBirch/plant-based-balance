import { withLambda } from '@netlify/aws-lambda-compat';
import legacy from '../functions/manychat-reconcile.js';

export default withLambda(legacy.handler);

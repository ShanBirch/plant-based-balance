import { withLambda } from '@netlify/aws-lambda-compat';
import legacy from '../functions/meta-ig-reconcile-inbox.js';

export default withLambda(legacy.handler);

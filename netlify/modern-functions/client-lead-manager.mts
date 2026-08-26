import { withLambda } from '@netlify/aws-lambda-compat';
import legacy from '../functions/client-lead-manager.js';

export default withLambda(legacy.handler);

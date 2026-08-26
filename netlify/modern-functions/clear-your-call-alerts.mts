import { withLambda } from '@netlify/aws-lambda-compat';
import legacy from '../functions/clear-your-call-alerts.js';

export default withLambda(legacy.handler);

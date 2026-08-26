import { withLambda } from '@netlify/aws-lambda-compat';
import legacy from '../functions/check-push-subscriptions.js';

export default withLambda(legacy.handler);

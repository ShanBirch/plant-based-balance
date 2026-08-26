import { withLambda } from '@netlify/aws-lambda-compat';
import legacy from '../functions/notify-admin-new-signup.js';

export default withLambda(legacy.handler);

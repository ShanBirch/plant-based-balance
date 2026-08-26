import { withLambda } from '@netlify/aws-lambda-compat';
import legacy from '../functions/repair-unread-dm-alerts.js';

export default withLambda(legacy.handler);

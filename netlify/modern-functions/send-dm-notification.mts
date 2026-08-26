import { withLambda } from '@netlify/aws-lambda-compat';
import 'web-push';
import legacy from '../functions/send-dm-notification.js';

export default withLambda(legacy.handler);

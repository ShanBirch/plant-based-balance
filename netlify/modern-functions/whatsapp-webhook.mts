import { withLambda } from '@netlify/aws-lambda-compat';
import legacy from '../functions/whatsapp-webhook.js';

export default withLambda(legacy.handler);

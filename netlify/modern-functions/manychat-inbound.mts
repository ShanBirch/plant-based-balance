import { withLambda } from '@netlify/aws-lambda-compat';
import legacy from '../functions/manychat-inbound.js';

export default withLambda(legacy.handler);

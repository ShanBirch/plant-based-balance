import { withLambda } from '@netlify/aws-lambda-compat';
import legacy from '../functions/mark-manual-dm-sent.js';

export default withLambda(legacy.handler);

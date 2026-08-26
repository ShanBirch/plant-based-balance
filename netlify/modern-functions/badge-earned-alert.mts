import { withLambda } from '@netlify/aws-lambda-compat';
import legacy from '../functions/badge-earned-alert.js';

export default withLambda(legacy.handler);

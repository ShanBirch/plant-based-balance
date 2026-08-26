import { withLambda } from '@netlify/aws-lambda-compat';
import legacy from '../functions/pulse-morning.js';

export default withLambda(legacy.handler);

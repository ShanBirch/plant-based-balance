import { withLambda } from '@netlify/aws-lambda-compat';
import legacy from '../functions/ig-engagement-priorities.js';

export default withLambda(legacy.handler);

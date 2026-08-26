import { withLambda } from '@netlify/aws-lambda-compat';
import legacy from '../functions/pulse-lunch.js';

export default withLambda(legacy.handler);

import { withLambda } from '@netlify/aws-lambda-compat';
import legacy from '../functions/first-workout-celebration.js';

export default withLambda(legacy.handler);

import { withLambda } from '@netlify/aws-lambda-compat';
import legacy from '../functions/recent-workout-touch-scan.js';

export default withLambda(legacy.handler);

import { withLambda } from '@netlify/aws-lambda-compat';
import legacy from '../functions/challenge-progress-refresh.js';

export default withLambda(legacy.handler);

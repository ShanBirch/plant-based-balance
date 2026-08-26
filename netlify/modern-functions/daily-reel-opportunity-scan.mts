import { withLambda } from '@netlify/aws-lambda-compat';
import legacy from '../functions/daily-reel-opportunity-scan.js';

export default withLambda(legacy.handler);

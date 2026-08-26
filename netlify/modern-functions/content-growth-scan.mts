import { withLambda } from '@netlify/aws-lambda-compat';
import legacy from '../functions/content-growth-scan.js';

export default withLambda(legacy.handler);

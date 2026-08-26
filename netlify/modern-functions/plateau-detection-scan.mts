import { withLambda } from '@netlify/aws-lambda-compat';
import legacy from '../functions/plateau-detection-scan.js';

export default withLambda(legacy.handler);

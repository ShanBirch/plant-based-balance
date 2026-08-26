import { withLambda } from '@netlify/aws-lambda-compat';
import legacy from '../functions/support-radar-scan.js';

export default withLambda(legacy.handler);

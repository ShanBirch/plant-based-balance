import { withLambda } from '@netlify/aws-lambda-compat';
import legacy from '../functions/social-journey-reminder-scan.js';

export default withLambda(legacy.handler);

import { withLambda } from '@netlify/aws-lambda-compat';
import legacy from '../functions/onboarding-scheduled-scan.js';

export default withLambda(legacy.handler);

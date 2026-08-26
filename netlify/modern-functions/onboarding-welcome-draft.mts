import { withLambda } from '@netlify/aws-lambda-compat';
import legacy from '../functions/onboarding-welcome-draft.js';

export default withLambda(legacy.handler);

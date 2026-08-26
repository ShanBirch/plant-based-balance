import { withLambda } from '@netlify/aws-lambda-compat';
import legacy from '../functions/accept-cohort-application.js';

export default withLambda(legacy.handler);

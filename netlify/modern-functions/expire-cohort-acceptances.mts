import { withLambda } from '@netlify/aws-lambda-compat';
import legacy from '../functions/expire-cohort-acceptances.js';

export default withLambda(legacy.handler);

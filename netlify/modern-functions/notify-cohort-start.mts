import { withLambda } from '@netlify/aws-lambda-compat';
import legacy from '../functions/notify-cohort-start.js';

export default withLambda(legacy.handler);

import { withLambda } from '@netlify/aws-lambda-compat';
import legacy from '../functions/submit-weekly-checkin.js';

export default withLambda(legacy.handler);

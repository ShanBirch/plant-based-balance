import { withLambda } from '@netlify/aws-lambda-compat';
import legacy from '../functions/submit-form-check-request.js';

export default withLambda(legacy.handler);

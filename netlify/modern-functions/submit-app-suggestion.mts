import { withLambda } from '@netlify/aws-lambda-compat';
import legacy from '../functions/submit-app-suggestion.js';

export default withLambda(legacy.handler);

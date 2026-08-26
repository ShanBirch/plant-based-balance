import { withLambda } from '@netlify/aws-lambda-compat';
import legacy from '../functions/weekly-wrapped-push.js';

export default withLambda(legacy.handler);

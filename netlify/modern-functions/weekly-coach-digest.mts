import { withLambda } from '@netlify/aws-lambda-compat';
import legacy from '../functions/weekly-coach-digest.js';

export default withLambda(legacy.handler);

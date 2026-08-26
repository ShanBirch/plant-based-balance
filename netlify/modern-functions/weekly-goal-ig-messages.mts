import { withLambda } from '@netlify/aws-lambda-compat';
import legacy from '../functions/weekly-goal-ig-messages.js';

export default withLambda(legacy.handler);

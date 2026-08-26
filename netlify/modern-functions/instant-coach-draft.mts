import { withLambda } from '@netlify/aws-lambda-compat';
import legacy from '../functions/instant-coach-draft.js';

export default withLambda(legacy.handler);

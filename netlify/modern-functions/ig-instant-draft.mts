import { withLambda } from '@netlify/aws-lambda-compat';
import legacy from '../functions/ig-instant-draft.js';

export default withLambda(legacy.handler);

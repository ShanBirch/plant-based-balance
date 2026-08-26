import { withLambda } from '@netlify/aws-lambda-compat';
import legacy from '../functions/ig-instant-draft-background.js';

export default withLambda(legacy.handler);
export const config = { background: true };

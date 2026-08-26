import { withLambda } from '@netlify/aws-lambda-compat';
import legacy from '../functions/add-ig-screenshot-context-background.js';

export default withLambda(legacy.handler);
export const config = { background: true };

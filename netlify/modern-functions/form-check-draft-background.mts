import { withLambda } from '@netlify/aws-lambda-compat';
import legacy from '../functions/form-check-draft-background.js';

export default withLambda(legacy.handler);
export const config = { background: true };

import { withLambda } from '@netlify/aws-lambda-compat';
import legacy from '../functions/needs-attention-draft.js';

export default withLambda(legacy.handler);

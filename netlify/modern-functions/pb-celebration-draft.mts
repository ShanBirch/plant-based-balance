import { withLambda } from '@netlify/aws-lambda-compat';
import legacy from '../functions/pb-celebration-draft.js';

export default withLambda(legacy.handler);

import { withLambda } from '@netlify/aws-lambda-compat';
import legacy from '../functions/content-radar-generate.js';

export default withLambda(legacy.handler);

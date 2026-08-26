import { withLambda } from '@netlify/aws-lambda-compat';
import legacy from '../functions/add-ig-screenshot-context.js';

export default withLambda(legacy.handler);

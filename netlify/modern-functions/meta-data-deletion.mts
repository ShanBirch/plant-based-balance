import { withLambda } from '@netlify/aws-lambda-compat';
import legacy from '../functions/meta-data-deletion.js';

export default withLambda(legacy.handler);

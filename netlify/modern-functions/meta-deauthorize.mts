import { withLambda } from '@netlify/aws-lambda-compat';
import legacy from '../functions/meta-deauthorize.js';

export default withLambda(legacy.handler);

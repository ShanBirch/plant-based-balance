import { withLambda } from '@netlify/aws-lambda-compat';
import 'vm';
import legacy from '../functions/perform-coach-action.js';

export default withLambda(legacy.handler);

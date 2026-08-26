import { withLambda } from '@netlify/aws-lambda-compat';
import legacy from '../functions/send-instagram-graph-action.js';

export default withLambda(legacy.handler);

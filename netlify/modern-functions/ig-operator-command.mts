import { withLambda } from '@netlify/aws-lambda-compat';
import legacy from '../functions/ig-operator-command.js';

export default withLambda(legacy.handler);

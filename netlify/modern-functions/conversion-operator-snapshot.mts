import { withLambda } from '@netlify/aws-lambda-compat';
import legacy from '../functions/conversion-operator-snapshot.js';

export default withLambda(legacy.handler);

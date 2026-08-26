import { withLambda } from '@netlify/aws-lambda-compat';
import legacy from '../functions/barcode-lookup.js';

export default withLambda(legacy.handler);

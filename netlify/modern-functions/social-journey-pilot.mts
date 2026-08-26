import { withLambda } from '@netlify/aws-lambda-compat';
import legacy from '../functions/social-journey-pilot.js';

export default withLambda(legacy.handler);

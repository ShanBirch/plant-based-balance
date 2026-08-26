import { withLambda } from '@netlify/aws-lambda-compat';
import 'web-push';
import legacy from '../functions/send-meal-plan-ready.js';

export default withLambda(legacy.handler);

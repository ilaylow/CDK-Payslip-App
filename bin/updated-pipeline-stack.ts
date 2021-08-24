#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { MasterStack } from '../lib/AWSMasterStack';

const app = new cdk.App();
new MasterStack(app, 'UpdatedPipelineStack', {
  env: {
    account: "527531474351",
    region: "us-east-2",
  }
});

app.synth();

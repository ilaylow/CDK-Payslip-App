#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { UpdatedPipelineStackStack } from '../lib/updated-pipeline-stack-stack';

const app = new cdk.App();
new UpdatedPipelineStackStack(app, 'UpdatedPipelineStackStack', {
  env: {
    account: "527531474351",
    region: "us-east-2",
  }
});

app.synth();

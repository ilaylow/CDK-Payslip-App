import * as cdk from '@aws-cdk/core';
import * as ec2 from '@aws-cdk/aws-ec2';

import { AWSPipelineStack } from './AWSPipelineStack';

const repoName: string = "payslip-image-repo";
const imageLimit: number = 1;

export class MasterStack extends cdk.Stack {
    constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        const vpc = new ec2.Vpc(this, 'myVpc', {
            maxAzs: 3,
        });

        let awsCdkPipelineStack = new AWSPipelineStack(this, "AWSCDKPipelineStack", repoName, vpc, props);
        awsCdkPipelineStack.buildStack(imageLimit);
    }
}
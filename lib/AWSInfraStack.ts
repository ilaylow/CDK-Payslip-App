import * as cdk from '@aws-cdk/core';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as ecspatterns from '@aws-cdk/aws-ecs-patterns';
import * as iam from '@aws-cdk/aws-iam';
import * as ecs from '@aws-cdk/aws-ecs';
import * as ecr from '@aws-cdk/aws-ecr';

export class AWSInfraStack extends cdk.Stack{
    vpc: ec2.Vpc;
    repoName: string;

    constructor(scope: cdk.Construct, id: string, repoName: string, vpc: ec2.Vpc, props?: cdk.StackProps){
        super(scope, id, props);
        this.vpc = vpc;
        this.repoName = repoName;
    }

    public createLoadBalancedFargateService(scope: cdk.Construct, vpc: ec2.Vpc, ecrRepository: ecr.Repository) {
        var fargateService = new ecspatterns.ApplicationLoadBalancedFargateService(scope, 'myLbFargateService', {
          vpc: vpc,
          memoryLimitMiB: 512,
          cpu: 256,
          assignPublicIp: true,
          listenerPort: 8080,
          taskImageOptions: {
            containerName: this.repoName,
            image: ecs.ContainerImage.fromEcrRepository(ecrRepository, "latest"),//ecs.ContainerImage.fromRegistry("okaycloud/dummywebserver:latest"), // Get Dummy Image
            containerPort: 8080,
          },
        });
        fargateService.taskDefinition.executionRole?.addManagedPolicy((iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonEC2ContainerRegistryPowerUser')));
        return fargateService;
      }
    
}
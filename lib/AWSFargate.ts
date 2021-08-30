import * as cdk from "@aws-cdk/core";
import * as ec2 from "@aws-cdk/aws-ec2";
import * as ecs from "@aws-cdk/aws-ecs";
import * as ecr from "@aws-cdk/aws-ecr";
import * as ecspatterns from "@aws-cdk/aws-ecs-patterns";
import * as iam from "@aws-cdk/aws-iam";

export class AWSInfraStack extends cdk.Construct{
    repoName: string;
    vpc: ec2.Vpc;

    constructor(scope: cdk.Construct, id: string, repoName: string, vpc: ec2.Vpc){
        super(scope, id);
        this.repoName = repoName;
        this.vpc = vpc;
    }

    public createLoadBalancedFargateService(construct: cdk.Construct,vpc: ec2.Vpc) {
        const securityGroup = new ec2.SecurityGroup(this, 'mySecurityGroup', {
            vpc: this.vpc,
            description: 'Allow port to connect to EC2',
            allowAllOutbound: true
        });

        securityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(8080), 'Allows internet to send request')

        var fargateService = new ecspatterns.ApplicationLoadBalancedFargateService(construct, 'myLbFargateService', {
            vpc: vpc,
            memoryLimitMiB: 2048,
            cpu: 1024,
            desiredCount: 1,
            assignPublicIp: true,
            securityGroups: [securityGroup],
            listenerPort: 8080,
            taskImageOptions: {
                containerName: this.repoName,
                image: ecs.ContainerImage.fromRegistry("okaycloud/dummywebserver:latest"),//ecs.ContainerImage.fromRegistry("okaycloud/dummywebserver:latest"), // Get Dummy Image
                containerPort: 8080,
            },
        });

        fargateService.taskDefinition.executionRole?.addManagedPolicy((iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonEC2ContainerRegistryPowerUser')));
        // Remove below since overrides docker health check, (but docker healthcheck isn't working either?)
        /* fargateService.targetGroup.configureHealthCheck({
            path: "/health",
            healthyHttpCodes: "200",
            port: "8080"
        }); */

        return fargateService;
    }
}




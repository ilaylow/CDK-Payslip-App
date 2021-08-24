import * as cdk from "@aws-cdk/core";
import * as ec2 from "@aws-cdk/aws-ec2";
import * as ecr from "@aws-cdk/aws-ecr";
import * as ecs from '@aws-cdk/aws-ecs';
import * as codebuild from '@aws-cdk/aws-codebuild';
import * as iam from '@aws-cdk/aws-iam';
import * as pipeline  from '@aws-cdk/aws-codepipeline';
import * as pipelineActions from '@aws-cdk/aws-codepipeline-actions';
import * as ecspatterns from '@aws-cdk/aws-ecs-patterns';

/* This stack will define the resources needed to initialise a codepipeline in AWS */

export class AWSPipelineStack extends cdk.Stack{
    sourceOutput: pipeline.Artifact = new pipeline.Artifact();
    buildOutput: pipeline.Artifact = new pipeline.Artifact();

    vpc: ec2.Vpc;
    ecrRepository: ecr.Repository;
    repoName: string;
    fargateService: ecs.FargateService;

    constructor(scope: cdk.Construct, id: string, repoName: string, vpc: ec2.Vpc, props?: cdk.StackProps){
        super(scope, id, props);
        this.repoName = repoName;

        this.ecrRepository = new ecr.Repository(this, this.repoName, {
            repositoryName: this.repoName,
        })
        
        this.fargateService = this.createLoadBalancedFargateService(this, vpc, this.ecrRepository).service;
        this.vpc = vpc;
    }

    public buildStack(imageLimit: number){
        /* Add lifecycle rule to ECR Repository */
        this.ecrRepository.addLifecycleRule({
            maxImageCount: imageLimit
        });

        /* Create pipeline project */
        var pipelineProject = new codebuild.PipelineProject(this, 'cicd-codepipeline', {
            projectName: "cicd-codepipeline",
            buildSpec: codebuild.BuildSpec.fromObject({
            version: '0.2',
            phases: {
                post_build: {
                commands: [
                    "echo creating imagedefinitions.json dynamically",
                    "printf '[{\"name\":\"" + this.repoName + "\",\"imageUri\": \"" + this.ecrRepository.repositoryUriForTag() + ":latest\"}]' > imagedefinitions.json",
                    "echo Build completed on `date`"
                ]
                }
            },
            artifacts: {
                files: [
                "imagedefinitions.json"
                ]
            }
            }),
            cache: codebuild.Cache.local(codebuild.LocalCacheMode.DOCKER_LAYER, codebuild.LocalCacheMode.CUSTOM)
        });
        pipelineProject.role?.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonEC2ContainerRegistryPowerUser'));
        
        /* Create Source Action From ECR */
        var ecrSourceAction = new pipelineActions.EcrSourceAction({
            actionName: "ECRSource",
            output: this.sourceOutput,
            repository: this.ecrRepository,
            imageTag: "latest",
        });
        
        /* Create Build Action From ECR */
        var ecrBuildAction = new pipelineActions.CodeBuildAction({
            actionName: "ECRBuild",
            project: pipelineProject,
            input: this.sourceOutput,
            outputs: [this.buildOutput],
        });

        /* Create Deploy Action From ECR to ECS Fargate Service */
        var deployAction = new pipelineActions.EcsDeployAction({
            actionName: 'EcsDeployAction',
            service: this.fargateService,
            input: this.buildOutput,
        });

        /* Build CDK Pipeline with different stages */
        var cdk_pipeline = new pipeline.Pipeline(this, 'cicd_pipeline_', {
        stages: [
            {
            stageName: 'Source',
            actions: [ecrSourceAction]
            },
            {
            stageName: 'Build',
            actions: [ecrBuildAction]
            },
            {
            stageName: 'Deploy',
            actions: [deployAction]
            },
        ],
        pipelineName: "cicd_pipeline",
        });

    };

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

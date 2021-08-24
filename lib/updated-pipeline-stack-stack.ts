import * as cdk from '@aws-cdk/core';
import * as ecr from '@aws-cdk/aws-ecr';
import * as ecs from '@aws-cdk/aws-ecs';
import * as ecspatterns from "@aws-cdk/aws-ecs-patterns";
import * as iam from "@aws-cdk/aws-iam";
import * as ec2 from "@aws-cdk/aws-ec2";
import * as pipeline from "@aws-cdk/aws-codepipeline";
import * as pipelineActions from "@aws-cdk/aws-codepipeline-actions";
import * as codebuild from '@aws-cdk/aws-codebuild'

const repoName: string = "payslip-image-repo";

export class UpdatedPipelineStackStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Define a Virtual Private Cloud
    // CIDR (Classless Inter Domain Routing) -> Given a subnet mask of /16
    var vpc = new ec2.Vpc(this, 'my.vpc', {
      cidr: '10.0.0.0/16',
      maxAzs: 2
    });

    // Create an ECR Repository to place docker images at
    const ecrRepository = new ecr.Repository(this, repoName, {
      repositoryName: repoName,
    });

    // Get build from ECR???
    // Create pipeline project
    var pipelineProject = new codebuild.PipelineProject(this, 'cicd-codepipeline', {
      projectName: "cicd-codepipeline",
      buildSpec: codebuild.BuildSpec.fromObject({
        version: '0.2',
        phases: {
          post_build: {
            commands: [
              "echo creating imagedefinitions.json dynamically",
              "printf '[{\"name\":\"" + repoName + "\",\"imageUri\": \"" + ecrRepository.repositoryUriForTag() + ":latest\"}]' > imagedefinitions.json",
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

    // Let us generate the artifact for the build output which is the artifact that has the imagedefinitions.json file
    // An imagedefinitions.json file is the file that contains the name of the repo and the Image's URI

    var sourceOutput = new pipeline.Artifact();
    var buildOutput = new pipeline.Artifact();

    var ecrSourceAction = new pipelineActions.EcrSourceAction({
      actionName: "ECRSource",
      output: sourceOutput,
      repository: ecrRepository,
      imageTag: "latest",
    });

    var ecrBuildAction = new pipelineActions.CodeBuildAction({
      actionName: "ECRBuild",
      project: pipelineProject,
      input: sourceOutput,
      outputs: [buildOutput],
    });

    var deployAction = new pipelineActions.EcsDeployAction({
      actionName: 'EcsDeployAction',
      service: this.createLoadBalancedFargateService(this, vpc, ecrRepository, pipelineProject).service,
      input: buildOutput,
    })

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

  // Creates load balancer fargate service 
  createLoadBalancedFargateService(scope: cdk.Construct, vpc: ec2.Vpc, ecrRepository: ecr.Repository, pipelineProject: codebuild.PipelineProject) {
    var fargateService = new ecspatterns.ApplicationLoadBalancedFargateService(scope, 'myLbFargateService', {
      vpc: vpc,
      memoryLimitMiB: 512,
      cpu: 256,
      assignPublicIp: true,
      listenerPort: 8080,
      taskImageOptions: {
        containerName: repoName,
        image: ecs.ContainerImage.fromRegistry("okaycloud/dummywebserver:latest"), // Get Dummy Image
        containerPort: 8080,
      },
    });
    fargateService.taskDefinition.executionRole?.addManagedPolicy((iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonEC2ContainerRegistryPowerUser')));
    return fargateService;
  }
}

import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as s3n from 'aws-cdk-lib/aws-s3-notifications';
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as sns from 'aws-cdk-lib/aws-sns';
import { Construct } from 'constructs';
import * as dotenv from 'dotenv';

dotenv.config();

export class ThumbingServerlessCdkStack extends cdk.Stack {

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const uploadsBucketName: string = process.env.UPLOADS_BUCKET_NAME as string;
    const assetsBucketName: string = process.env.ASSETS_BUCKET_NAME as string;
    const folderInput: string = process.env.THUMBING_S3_FOLDER_INPUT as string;
    const folderOutput: string = process.env.THUMBING_S3_FOLDER_OUTPUT as string;
    const webhookUrl: string = process.env.THUMBING_WEBHOOK_URL as string;
    const topicName: string = process.env.THUMBING_TOPIC_NAME as string;
    const functionPath: string = process.env.THUMBING_FUNCTION_PATH as string;
    
    console.log('uploadBucketName ', uploadsBucketName);
    console.log('assetsBucketName ', assetsBucketName);
    console.log('folderInput ', folderInput);
    console.log('folderOutput ', folderOutput);
    console.log('webhookUrl ', webhookUrl);
    console.log('topicName ', topicName);
    console.log('functionPath ', functionPath);

    //const uploadsBucket = this.importBucket('UploadsBucket', uploadsBucketName);
    const uploadsBucket = this.createBucket(uploadsBucketName);
    const assetsBucket = this.importBucket('AssetsBucket', assetsBucketName);
    const lambda = this.createLambda(folderInput, folderOutput, functionPath, assetsBucketName);

    // Create and Attach policies for S3 access
    const s3ReadWritePolicyForUploads = this.createPolicyBucketAccess(uploadsBucket.bucketArn)
    const s3ReadWritePolicyForAssets = this.createPolicyBucketAccess(assetsBucket.bucketArn)
    lambda.addToRolePolicy(s3ReadWritePolicyForUploads);
    lambda.addToRolePolicy(s3ReadWritePolicyForAssets);
  
    // Create topic and subscription
    /*const snsTopic = this.createSnsTopic(topicName)
    this.createSnsSubscription(snsTopic, webhookUrl)*/

    // Add our s3 event notifications
    this.createS3NotifyToLambda(lambda, uploadsBucket)
    //this.createS3NotifyToSns(folderOutput, snsTopic, assetsBucket)
    
    // Create and Attach policies for SNS
    /*const snsPublishPolicy = this.createPolicySnsPublish(snsTopic.topicArn)
    lambda.addToRolePolicy(snsPublishPolicy);*/

  }

  createBucket(bucketName: string): s3.IBucket {
    const bucket = new s3.Bucket(this, 'UploadsBucket', {
      bucketName: bucketName,
      removalPolicy: cdk.RemovalPolicy.DESTROY
    });
    return bucket;
  }

  importBucket(logicalBucketName: string, bucketName: string): s3.IBucket {
    const bucket = s3.Bucket.fromBucketName(this, logicalBucketName, bucketName);
    return bucket;
  }

  createLambda(folderIntput: string, folderOutput: string, functionPath: string, assetsBucketName: string): lambda.IFunction {
    const logicalName = 'ThumbLambda';
    const code = lambda.Code.fromAsset(functionPath)
    const lambdaFunction = new lambda.Function(this, logicalName, {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: code,
      environment: {
        DEST_BUCKET_NAME: assetsBucketName,
        FOLDER_INPUT: folderIntput,
        FOLDER_OUTPUT: folderOutput,
        PROCESS_WIDTH: '512',
        PROCESS_HEIGHT: '512'
      }
    });
    return lambdaFunction;
  }

  createS3NotifyToLambda(lambda: lambda.IFunction, bucket: s3.IBucket): void {
    const destination = new s3n.LambdaDestination(lambda);
    bucket.addEventNotification(
      s3.EventType.OBJECT_CREATED_PUT,
      destination
    )
    bucket
  }

  createPolicyBucketAccess(bucketArn: string){
    const s3ReadWritePolicy = new iam.PolicyStatement({
      actions: [
        's3:GetObject',
        's3:PutObject',
      ],
      resources: [
        `${bucketArn}/*`,
      ]
    });
    return s3ReadWritePolicy;
  }

  createSnsTopic(topicName: string): sns.ITopic{
    const logicalName = "ThumbingTopic";
    const snsTopic = new sns.Topic(this, logicalName, {
      topicName: topicName
    });
    return snsTopic;
  }

  createSnsSubscription(snsTopic: sns.ITopic, webhookUrl: string): sns.Subscription {
    const snsSubscription = snsTopic.addSubscription(
      new subscriptions.UrlSubscription(webhookUrl)
    )
    return snsSubscription;
  }

  createS3NotifyToSns(prefix: string, snsTopic: sns.ITopic, bucket: s3.IBucket): void {
    const destination = new s3n.SnsDestination(snsTopic)
    bucket.addEventNotification(
      s3.EventType.OBJECT_CREATED_PUT, 
      destination,
      { prefix: prefix }
    );
  }

  /*createPolicySnsPublish(topicArn: string){
    const snsPublishPolicy = new iam.PolicyStatement({
      actions: [
        'sns:Publish',
      ],
      resources: [
        topicArn
      ]
    });
    return snsPublishPolicy;
  }*/
}
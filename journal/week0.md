# Week 0 — Billing and Architecture


## Installing the AWS CLI with Gitpod

The AWS CLI is used to perform AWS commands through the terminal. Let's install it automatically with Gitpod to have it at launch.


### Install AWS CLI

Tasks performed:
- Update `.gitpod.yml` to include the following task.

```sh
tasks:
  - name: aws-cli
    env:
      AWS_CLI_AUTO_PROMPT: on-partial
    init: |
      cd /workspace
      curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
      unzip awscliv2.zip
      sudo ./aws/install
      cd $THEIA_WORKSPACE_ROOT
```
This task downloads the AWS CLI package, unpacks it and installs it with root privileges every time gitpod is launched.

![AWSCLI](https://github.com/awadiagne/aws-bootcamp-cruddur-2023/blob/main/journal/screenshots/Week_0/AWS%20CLI%20with%20Gitpod.PNG)

### Create a new User and Generate AWS Access and Secret Keys

- I went to [IAM Users Console](https://us-east-1.console.aws.amazon.com/iamv2/home?region=us-east-1#/users) and created a new user
- `Enable console access` for the user
- I then created a new `Admin` Group with `AdministratorAccess` privileges
- I created Access and Secret Keys for the new user
- I created an Alias for the new user
- I then downloaded the CSV files with the credentials

![Bootcamp User](https://github.com/awadiagne/aws-bootcamp-cruddur-2023/blob/main/journal/screenshots/Week_0/Bootcamp%20User%20Created.PNG)

### Set Env Vars

We will set these credentials for the current bash terminal
```
export AWS_ACCESS_KEY_ID="************"
export AWS_SECRET_ACCESS_KEY="************************************"
export AWS_DEFAULT_REGION="*********"
```

Make Gitpod remember these credentials every time the workspace is launched
```
gp env AWS_ACCESS_KEY_ID="************"
gp env AWS_SECRET_ACCESS_KEY="************************************"
gp env AWS_DEFAULT_REGION="*********"
```

### Check that the AWS CLI is working and the credentials are correctly set

```sh
aws sts get-caller-identity
```
![Id Set](https://github.com/awadiagne/aws-bootcamp-cruddur-2023/blob/main/journal/screenshots/Week_0/Id%20Correctly%20Set.PNG)

## Enable Billing 

I turned on Billing Alerts to receive alerts when the billing exceeds a threshold defined.


- In the Root Account, I went to the [Billing Page](https://console.aws.amazon.com/billing/)
- Under `Billing Preferences`, I chose `Receive Billing Alerts`
- Save Preferences

![Billing Enabled](https://github.com/awadiagne/aws-bootcamp-cruddur-2023/blob/main/journal/screenshots/Week_0/Billing%20Alerts%20Activated.PNG)

## Creating a Billing Alarm

### Create SNS Topic

[Docs to aws sns create-topic](https://docs.aws.amazon.com/cli/latest/reference/sns/create-topic.html)

- An SNS topic must be created before the creation of an alarm.
- The SNS topic will deliver an alert on overbilling to the specified email address

- This is how I created the SNS Topic
```sh
aws sns create-topic --name billing-alarm
```

- Then I subscribed to the TopicARN and provided the email to be notified
```sh
aws sns subscribe \
    --topic-arn TopicARN \
    --protocol email \
    --notification-endpoint example@email.com
```

![Topic Subscription](https://github.com/awadiagne/aws-bootcamp-cruddur-2023/blob/main/journal/screenshots/Week_0/Topic%20Susbcription%20Created.PNG)

- And finally, I confirmed the subscription in my mailbox.

#### Create Alarm

[Docs to aws cloudwatch put-metric-alarm](https://docs.aws.amazon.com/cli/latest/reference/cloudwatch/put-metric-alarm.html)
[Docs to create an Alarm via AWS CLI](https://aws.amazon.com/premiumsupport/knowledge-center/cloudwatch-estimatedcharges-alarm/)
- I updated the configuration script with the TopicARN created earlier

```sh
aws cloudwatch put-metric-alarm --cli-input-json file://files/json/alarm_config.json
```

![Alarm Created](https://github.com/awadiagne/aws-bootcamp-cruddur-2023/blob/main/journal/screenshots/Week_0/CloudWatch%20Alarm%20Created.PNG)

## Create an AWS Budget

[Docs to aws budgets create-budget](https://awscli.amazonaws.com/v2/documentation/api/latest/reference/budgets/index.html)

- I checked my AWS Account ID
```sh
aws sts get-caller-identity --query Account --output text
```

- I supplied my AWS Account ID
- Created the json files for the budget and the subscribers to notify in case of alert

```sh
aws budgets create-budget \
    --account-id ************ \
    --budget file://files/json/budget.json \
    --notifications-with-subscribers file://files/json/subscribers.json
```

![Budget Created](https://github.com/awadiagne/aws-bootcamp-cruddur-2023/blob/main/journal/screenshots/Week_0/Budget%20Created.PNG)

## Here I have recreated the Conceptual Architecture of Cruddur with LucidCharts

![Cruddur Conceptual Archi](https://github.com/awadiagne/aws-bootcamp-cruddur-2023/blob/main/journal/screenshots/Week_0/Cruddur%20Conceptual%20Architecture.PNG)

## Here I have recreated the Logical Architecture of Cruddur with LucidCharts

![Cruddur Logical Archi](https://github.com/awadiagne/aws-bootcamp-cruddur-2023/blob/main/journal/screenshots/Week_0/Cruddur%20Logical%20Architecture.png)

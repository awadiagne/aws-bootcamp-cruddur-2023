# Week 5 — DynamoDB and Serverless Caching

## The Boundaries of DynamoDB

- When you write a query you have provide a Primary Key (equality) eg. pk = 'Awa'
- Are you allowed to "update" the Hash and Range?
  - No, whenever you change a key (simple or composite) eg. pk or sk you have to create a new item.
    - you have to delete the old one
- Key condition expressions for query only for RANGE, HASH is only equality 
- Don't create UUID for entity if you don't have an access pattern for it

4 Access Patterns are modelled here : https://lucid.app/lucidchart/8f58a19d-3821-4529-920f-5bb802d6c6a3/edit?invitationId=inv_e47bc316-9caa-4aee-940f-161e01e22715&page=0_0#

## Pattern A  (showing a single conversation)

A user wants to see a list of messages that belong to a message group.
The messages must be ordered by the *created_at* timestamp from newest to oldest (DESC)

```sql
SELECT
  messages.uuid,
  messages.display_name,
  messages.message,
  messages.handle,
  messages.created_at -- sk
FROM messages
WHERE
  messages.message_group_uuid = {{ message_group_uuid }} -- pk
ORDER BY messages.created_at DESC
```

> *message_group_uuid* comes from Pattern B

## Pattern B (list of conversations)

A user wants to see a list of previous conversations.
- These conversations are listed from newest to oldest (DESC)
- We want to see the other person we are talking to.
- We want to see the last message (from whomever) in summary.

```sql
SELECT
  message_groups.uuid,
  message_groups.other_user_uuid,
  message_groups.other_user_display_name,
  message_groups.other_user_handle,
  message_groups.last_message,
  message_groups.last_message_at
FROM message_groups
WHERE
  message_groups.user_uuid = {{ user_uuid }} --pk
ORDER BY message_groups.last_message_at DESC
```

> We need a Global Secondary Index (GSI)

## Pattern C (create a message)

```sql
INSERT INTO messages (
  user_uuid,
  display_name,
  handle,
  created_at
)
VALUES (
  {{ user_uuid }},
  {{ display_name }},
  {{ handle }},
  {{ created_at }}
);
```

## Pattern D (update a message_group for the last message)

When a user creates a message, we need to update the conversation
to display the last message information for the conversation

```sql
UPDATE message_groups
SET 
  other_user_uuid = {{ other_user_uuid }}
  other_user_display_name = {{ other_user_display_name }}
  other_user_handle = {{ other_user_handle }}
  last_message = {{ last_message }}
  last_message_at = {{ last_message_at }}
WHERE 
  message_groups.uuid = {{ message_group_uuid }}
  AND message_groups.user_uuid = {{ user_uuid }}
```

## Install Boto3

*Boto3* is the AWS SDK for Python that is used  to create, configure, and manage AWS services, such as Amazon Elastic Compute Cloud (Amazon EC2) and Amazon Simple Storage Service (Amazon S3). The SDK provides an object-oriented API as well as low-level access to AWS services.

> Ref: https://boto3.amazonaws.com/v1/documentation/api/latest/index.html

- Let's add *boto3* in the `backend-flask/requirements.txt` file and install it:

```sh
  cd backend-flask
  pip install -r requirements.txt
```

## Load Schema in DynamoDB

- Let's create a script to create a table in DynamoDB using boto3 `backend-flask/bin/ddb/schema-load`:

```py
#!/usr/bin/env python3

import boto3
import sys

attrs = {
  'endpoint_url': 'http://localhost:8000'
}

if len(sys.argv) == 2:
  if "prod" in sys.argv[1]:
    attrs = {}

ddb = boto3.client('dynamodb',**attrs)

table_name = 'cruddur-messages'

response = ddb.create_table(
  TableName=table_name,
  AttributeDefinitions=[
    {
      'AttributeName': 'pk',
      'AttributeType': 'S'
    },
    {
      'AttributeName': 'sk',
      'AttributeType': 'S'
    },
  ],
  KeySchema=[
    {
      'AttributeName': 'pk',
      'KeyType': 'HASH'
    },
    {
      'AttributeName': 'sk',
      'KeyType': 'RANGE'
    },
  ],
  BillingMode='PROVISIONED',
  ProvisionedThroughput={
      'ReadCapacityUnits': 5,
      'WriteCapacityUnits': 5
  }
)

print(response)
```

- Check that DynamoDB local is defined on docker-compose.yml before running tests:
![DynamoDB Docker Compose](https://github.com/awadiagne/aws-bootcamp-cruddur-2023/blob/main/journal/screenshots/Week_5/DynamoDB_Docker_Compose.PNG)

- On running schema-load:

![Schema Load](https://github.com/awadiagne/aws-bootcamp-cruddur-2023/blob/main/journal/screenshots/Week_5/Schema_Load.PNG)

## Write DynamoDB scripts utilities and Access Patterns scripts

### Utilities

- Let's create other utility scripts for DynamoDB:

  * `backend-flask/bin/ddb/list-tables`:
```sh
#! /usr/bin/bash
set -e # stop if it fails at any point

if [ "$1" = "prod" ]; then
  ENDPOINT_URL=""
else
  ENDPOINT_URL="--endpoint-url=http://localhost:8000"
fi

aws dynamodb list-tables $ENDPOINT_URL \
--query TableNames \
--output table
```

  * `backend-flask/bin/ddb/drop`:  
```sh
#! /usr/bin/bash

set -e # stop if it fails at any point

if [ -z "$1" ]; then
  echo "No TABLE_NAME argument supplied eg ./bin/ddb/drop cruddur-messages prod "
  exit 1
fi
TABLE_NAME=$1

if [ "$2" = "prod" ]; then
  ENDPOINT_URL=""
else
  ENDPOINT_URL="--endpoint-url=http://localhost:8000"
fi

echo "deleting table: $TABLE_NAME"

aws dynamodb delete-table $ENDPOINT_URL \
  --table-name $TABLE_NAME
```
  
  * `backend-flask/bin/ddb/seed`: See this [file](backend-flask/bin/ddb/seed)
Here is the conversation successfully seeded into DynamoDB local:

![DDB Conversation Seeded](https://github.com/awadiagne/aws-bootcamp-cruddur-2023/blob/main/journal/screenshots/Week_5/DDB_Conversation_Seeded.PNG)

  * `backend-flask/bin/ddb/scan`: See this [file]: (backend-flask/bin/ddb/scan)

```py
#!/usr/bin/env python3

import boto3

attrs = {
  'endpoint_url': 'http://localhost:8000'
}
ddb = boto3.resource('dynamodb',**attrs)
table_name = 'cruddur-messages'

table = ddb.Table(table_name)
response = table.scan()

items = response['Items']
for item in items:
  print(item)
```

The scan script output:

![DDB Conversation Scanned](https://github.com/awadiagne/aws-bootcamp-cruddur-2023/blob/main/journal/screenshots/Week_5/DDB_Conversation_Scanned.PNG)

### Access patterns scripts

  * `backend-flask/bin/ddb/patterns/get-conversation`:  See this [file](backend-flask/bin/ddb/get-conversation)

![Get Conversation Consumed Capacity](https://github.com/awadiagne/aws-bootcamp-cruddur-2023/blob/main/journal/screenshots/Week_5/Get_Conversation_Consumed_Capacity.PNG)

![Get Conversation](https://github.com/awadiagne/aws-bootcamp-cruddur-2023/blob/main/journal/screenshots/Week_5/Get_Conversation.PNG)

  * `backend-flask/bin/ddb/patterns/list-conversation`: See this [file](backend-flask/bin/ddb/list-conversation)

![List Conversation](https://github.com/awadiagne/aws-bootcamp-cruddur-2023/blob/main/journal/screenshots/Week_5/List_Conversation.PNG)

## Implement Access Patterns

### Create DynamoDB Service

- Let's now create the service to communicate with DynamoDB with this file `backend-flask/lib/ddb.py`:

```py
import boto3
import sys
from datetime import datetime, timedelta, timezone
import uuid
import os

class Ddb:
  
  def client():
    endpoint_url = os.getenv("AWS_ENDPOINT_URL")
    if endpoint_url:
      attrs = { 'endpoint_url': endpoint_url }
    else:
      attrs = {}
    dynamodb = boto3.client('dynamodb',**attrs)
    return dynamodb  
  
  def list_message_groups(client,my_user_uuid):
    current_year = datetime.datetime.now().year
    table_name = 'cruddur-messages'
    query_params = {
      'TableName': table_name,
      'KeyConditionExpression': 'pk = :pk AND begins_with(sk,:year)',
      'ScanIndexForward': False,
      'Limit': 20,
      'ExpressionAttributeValues': {
        ':year': {'S': str(current_year) },
        ':pkey': {'S': f"GRP#{my_user_uuid}"}
      }
    }
    print('query-params')
    print(query_params)
    print('client')
    print(client)

    # query the table
    response = client.query(**query_params)
    items = response['Items']

    results = []
    for item in items:
      last_sent_at = item['sk']['S']
      results.append({
        'uuid': item['message_group_uuid']['S'],
        'display_name': item['user_display_name']['S'],
        'handle': item['user_handle']['S'],
        'message': item['message']['S'],
        'created_at': last_sent_at
      })
    return results
```

- Now, let's create a script that retrieves the Cognito users username and sub `backend-flask/bin/cognito/list-users`:

```py
#!/usr/bin/env python3

import boto3
import os
import json

userpool_id = os.getenv("AWS_COGNITO_USER_POOL_ID")
client = boto3.client('cognito-idp')
params = {
  'UserPoolId': userpool_id,
  'AttributesToGet': [
      'preferred_username',
      'sub'
  ]
}
response = client.list_users(**params)
users = response['Users']

print(json.dumps(users, sort_keys=True, indent=2, default=str))

dict_users = {}
for user in users:
  attrs = user['Attributes']
  sub    = next((a for a in attrs if a["Name"] == 'sub'), None)
  handle = next((a for a in attrs if a["Name"] == 'preferred_username'), None)
  dict_users[handle['Value']] = sub['Value']

print(dict_users)
```
![List Cognito Users](https://github.com/awadiagne/aws-bootcamp-cruddur-2023/blob/main/journal/screenshots/Week_5/List_Cognito_Users.PNG)

- Now, let's create a script that update the Cognito users' ids in the DB `backend-flask/db/update-cognito-user-ids`:

```py
#!/usr/bin/env python3

import boto3
import os
import sys

current_path = os.path.dirname(os.path.abspath(__file__))
parent_path = os.path.abspath(os.path.join(current_path, '..', '..'))
sys.path.append(parent_path)
from lib.db import db

def update_users_with_cognito_user_id(handle,sub):
  sql = """
    UPDATE public.users
    SET cognito_user_id = %(sub)s
    WHERE
      users.handle = %(handle)s;
  """
  db.query_commit(sql,{
    'handle' : handle,
    'sub' : sub
  })

def get_cognito_user_ids():
  userpool_id = os.getenv("AWS_COGNITO_USER_POOL_ID")
  client = boto3.client('cognito-idp')
  params = {
    'UserPoolId': userpool_id,
    'AttributesToGet': [
        'preferred_username',
        'sub'
    ]
  }
  response = client.list_users(**params)
  users = response['Users']
  dict_users = {}
  for user in users:
    attrs = user['Attributes']
    sub    = next((a for a in attrs if a["Name"] == 'sub'), None)
    handle = next((a for a in attrs if a["Name"] == 'preferred_username'), None)
    dict_users[handle['Value']] = sub['Value']
  return dict_users


users = get_cognito_user_ids()

for handle, sub in users.items():
  print('----',handle,sub)
  update_users_with_cognito_user_id(
    handle=handle,
    sub=sub
  )
```

![Update Cognito Users Ids](https://github.com/awadiagne/aws-bootcamp-cruddur-2023/blob/main/journal/screenshots/Week_5/Update_Cognito_Users_Ids.PNG)

- Now, we can update `backend-flask/app.py` to get the cognito user id on creating a message group and a message:

```py
@app.route("/api/message_groups", methods=['GET'])
def data_message_groups():
  access_token = extract_access_token(request.headers)
  try:
    claims = cognito_jwt_token.verify(access_token)
    cognito_user_id = claims['sub']
    model = MessageGroups.run(cognito_user_id=cognito_user_id)
    if model['errors'] is not None:
      return model['errors'], 422
    else:
      return model['data'], 200

  except TokenVerifyError as e:
    app.logger.debug(e)
    return {}, 401

@app.route("/api/messages/<string:message_group_uuid>", methods=['GET'])
def data_messages(message_group_uuid):
  user_sender_handle = 'Awa'
  user_receiver_handle = request.args.get('user_receiver_handle')

  access_token = extract_access_token(request.headers)
  try:
    claims = cognito_jwt_token.verify(access_token)
    cognito_user_id = claims['sub']
    model = Messages.run(
      message_group_uuid=message_group_uuid,
      cognito_user_id=cognito_user_id
    )
    if model['errors'] is not None:
      return model['errors'], 422
    else:
      return model['data'], 200
    return
  except TokenVerifyError as e:
    app.logger.debug(e)
    return {}, 401

@app.route("/api/messages", methods=['POST','OPTIONS'])
@cross_origin()
def data_create_message():
  access_token = extract_access_token(request.headers)
  try:
    claims = cognito_jwt_token.verify(access_token)
    # authenicatied request
    app.logger.debug("authenicated")
    cognito_user_id = claims['sub']
    message = request.json['message']

    message_group_uuid   = request.json.get('message_group_uuid',None)
    user_receiver_handle = request.json.get('user_receiver_handle',None)

    if message_group_uuid == None:
      # Create for the first time
      model = CreateMessage.run(
        mode="create",
        message=message,
        cognito_user_id=cognito_user_id,
        user_receiver_handle=user_receiver_handle
      )
    else:
      # Push onto existing Message Group
      model = CreateMessage.run(
        mode="update",
        message=message,
        message_group_uuid=message_group_uuid,
        cognito_user_id=cognito_user_id
      )

    if model['errors'] is not None:
      return model['errors'], 422
    else:
      return model['data'], 200
  except TokenVerifyError as e:
    # unauthenicatied request
    app.logger.debug(e)
    app.logger.debug("unauthenicated")
    return {}, 401
```

- Now, we can also update `backend-flask/services/message_groups.py` to create a message group:

```py
from lib.ddb import Ddb
from lib.db import db

class MessageGroups:
  def run(cognito_user_id):
    model = {
      'errors': None,
      'data': None
    }

    sql = db.template('users','uuid_from_cognito_user_id')
    my_user_uuid = db.query_value(sql,{'cognito_user_id': cognito_user_id})

    print("UUID",my_user_uuid)


    ddb = Ddb.client()
    data = Ddb.list_message_groups(ddb, my_user_uuid)
    print("list_message_groups:",data)
    model['data'] = data
    return models
```

- Let's do the same for `backend-flask/services/messages.py`
```py
from datetime import datetime, timedelta, timezone
from lib.ddb import Ddb
from lib.db import db

class Messages:
  def run(message_group_uuid,cognito_user_id):
    model = {
      'errors': None,
      'data': None
    }

    sql = db.template('users','uuid_from_cognito_user_id')
    my_user_uuid = db.query_value(sql,{'cognito_user_id': cognito_user_id})
    # TODO: we're suppose to check that we have permission to access
    # this message_group_uuid, its missing in our access pattern.

    ddb = Ddb.client()
    data = Ddb.list_messages(ddb, message_group_uuid)
    print("list_messages:",data)

    model['data'] = data
    return model
```

- Let's now create a script to get the user's UUID from its cognito user id in `backend-flask/bin/db/sql/users/uuid_from_cognito_user_id`:

```sql
SELECT 
  users.uuid
FROM public.users
WHERE 
  users.cognito_user_id = %(cognito_user_id)s
```

### Update Frontend to add Authorization Header

We'll perform the update for:

* `frontend-react-js/src/pages/MessageGroupPage.js`
* `frontend-react-js/src/pages/HomeFeedPage.js`
* `frontend-react-js/src/pages/MessageGroupsPage.js`

```js
const res = await fetch(backend_url, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("access_token")}`
        },
        method: "GET"
      });
```

### Implement (Pattern A) Listing Messages in Message Group into Application

- In `frontend-react-js/src/App.js`, let's add an endpoint for message group:

```js
  {
    path: "/messages/:message_group_uuid",
    element: <MessageGroupPage />
  }
```

![Listing Messages](https://github.com/awadiagne/aws-bootcamp-cruddur-2023/blob/main/journal/screenshots/Week_5/Listing_Messages.PNG)
 
### Implement (Pattern B) Listing Messages Group into Application

- On clicking on *Messages* for a new message group, this one should be created with the message:

![Messages In Message Group](https://github.com/awadiagne/aws-bootcamp-cruddur-2023/blob/main/journal/screenshots/Week_5/Messages_In_Message_Group.PNG)

### Implement (Pattern C) Creating a Message for an existing Message Group into Application - Implement (Pattern D) Creating a Message for a new Message Group into Application

On submitting a message this one should be updated to add the message for an existing message group else, a message group is created:

- In `frontend-react-js/src/App.js`, here are the two endpoints for a adding a message to an existing and a new message group:

```js
{
  path: "/messages/:message_group_uuid",
  element: <MessageGroupPage />
},
{
  path: "/messages/new/:handle",
  element: <MessageGroupNewPage />
}
```

- We'll update `frontend-react-js/src/components/MessageForm.js`:

```js
  if (params.handle) {
    json.user_receiver_handle = params.handle
  } else {
    json.message_group_uuid = params.message_group_uuid
  }
```
- On the backend, if the *handle* is set, we must create a new message group. Else, *message_group_uuid* is set, then we just have the update the existing group:
```py
  message_group_uuid   = request.json.get('message_group_uuid',None)
  user_receiver_handle = request.json.get('user_receiver_handle',None)

  if message_group_uuid == None:
    model = CreateMessage.run(
      mode="create",
      message=message,
      cognito_user_id=cognito_user_id,
      user_receiver_handle=user_receiver_handle
    )
  else:
    model = CreateMessage.run(
      mode="update",
      message=message,
      message_group_uuid=message_group_uuid,
      cognito_user_id=cognito_user_id
    )
  ...
  if (mode == "update"):
    data = Ddb.create_message(
      client=ddb,
      message_group_uuid=message_group_uuid,
      message=message,
      my_user_uuid=my_user['uuid'],
      my_user_display_name=my_user['display_name'],
      my_user_handle=my_user['handle']
    )
  elif (mode == "create"):
    data = Ddb.create_message_group(
      client=ddb,
      message=message,
      my_user_uuid=my_user['uuid'],
      my_user_display_name=my_user['display_name'],
      my_user_handle=my_user['handle'],
      other_user_uuid=other_user['uuid'],
      other_user_display_name=other_user['display_name'],
      other_user_handle=other_user['handle']
    )
```

- The result when a message is sent in a new message group:

![Message In New Message Group](https://github.com/awadiagne/aws-bootcamp-cruddur-2023/blob/main/journal/screenshots/Week_5/Message_In_New_Message_Group.PNG)

- When a message in sent in an existing message group:

![Message In Existing Message Group](https://github.com/awadiagne/aws-bootcamp-cruddur-2023/blob/main/journal/screenshots/Week_5/Message_In_Existing_Message_Group.PNG)


### Implement (Pattern E) Updating a Message Group using DynamoDB Streams

We'll use *DynamoDB streams* to update our message group in an existing conversation when a new message is sent. To do so, we'l follow these steps:

- Create a VPC endpoint for dynamoDB service on our VPC:

![Create VPC Endpoint](https://github.com/awadiagne/aws-bootcamp-cruddur-2023/blob/main/journal/screenshots/Week_5/Create_VPC_Endpoint.PNG)

- Create a Python Lambda function in our VPC:

```py
import json
import boto3
from boto3.dynamodb.conditions import Key, Attr

dynamodb = boto3.resource(
 'dynamodb',
 region_name='ca-central-1',
 endpoint_url="http://dynamodb.ca-central-1.amazonaws.com"
)

def lambda_handler(event, context):
  pk = event['Records'][0]['dynamodb']['Keys']['pk']['S']
  sk = event['Records'][0]['dynamodb']['Keys']['sk']['S']
  if pk.startswith('MSG#'):
    group_uuid = pk.replace("MSG#","")
    message = event['Records'][0]['dynamodb']['NewImage']['message']['S']
    print("GRUP ===>",group_uuid,message)
    
    table_name = 'cruddur-messages'
    index_name = 'message-group-sk-index'
    table = dynamodb.Table(table_name)
    data = table.query(
      IndexName=index_name,
      KeyConditionExpression=Key('message_group_uuid').eq(group_uuid)
    )
    print("RESP ===>",data['Items'])
    
    # recreate the message group rows with new SK value
    for i in data['Items']:
      delete_item = table.delete_item(Key={'pk': i['pk'], 'sk': i['sk']})
      print("DELETE ===>",delete_item)
      
      response = table.put_item(
        Item={
          'pk': i['pk'],
          'sk': sk,
          'message_group_uuid':i['message_group_uuid'],
          'message':message,
          'user_display_name': i['user_display_name'],
          'user_handle': i['user_handle'],
          'user_uuid': i['user_uuid']
        }
      )
      print("CREATE ===>",response)
```

To do so, we can create a new role while creating the Lambda and add the permissions later. We'll also `Enable VPC` and select the subnets and the security group.

- Grant the lambda IAM role permission to read the DynamoDB stream events: `AWSLambdaInvocation-DynamoDB` and `AmazonDynamoDBFullAccess`

- Enable streams on the table with `'new image'` attributes included so that the entire item as it appears after it was changed.
* First, let's update the `backend-flask/bin/ddb/schema-load` script by adding Global Secondary Indexes at the end of the table definition and its attribute in the AttributesDefinition section:
```py
{
  'AttributeName': 'message_group_uuid',
  'AttributeType': 'S'
}
...
'GlobalSecondaryIndexes':[{
    'IndexName':'message-group-sk-index',
    'KeySchema':[{
      'AttributeName': 'message_group_uuid',
      'KeyType': 'HASH'
    },{
      'AttributeName': 'sk',
      'KeyType': 'RANGE'
    }],
    'Projection': {
      'ProjectionType': 'ALL'
    },
    'ProvisionedThroughput': {
      'ReadCapacityUnits': 5,
      'WriteCapacityUnits': 5
    },
}]
```

* We run the script to create the DynamoDB table in our AWS account: `backend-flask/bin/ddb/schema-load prod`.

* Then, we enable DynamoDb streams in the AWS Management Console.

- Add our function as a trigger on the stream
In DynamoDB console, Go the *cruddur-messages* table, and click on the `Exports and Streams` tab to add a trigger.

![DDB Streams Lambda Trigger](https://github.com/awadiagne/aws-bootcamp-cruddur-2023/blob/main/journal/screenshots/Week_5/DDB_Streams_Lambda_Trigger.PNG)

Now, we just have to update our `docker-compose.yml` file to use our production DynamoDB table instead of the local one. All we have to do is remove the *AWS_ENDPOINT_URL* env variable.

On the following screenshot, when we sent a new message, it created a message group. Then, we sent another message and the message group is updated: 

![Update Message Group](https://github.com/awadiagne/aws-bootcamp-cruddur-2023/blob/main/journal/screenshots/Week_5/Update_Message_Group.PNG)

![Lambda Logs](https://github.com/awadiagne/aws-bootcamp-cruddur-2023/blob/main/journal/screenshots/Week_5/Lambda_Logs.PNG)
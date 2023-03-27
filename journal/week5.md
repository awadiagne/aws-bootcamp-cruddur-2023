# Week 5 — DynamoDB and Serverless Caching

## The Boundaries of DynamoDB

- When you write a query you have provide a Primary Key (equality) eg. pk = 'andrew'
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

- Let's add *boto3* in the `backend-flask/requirements.txt` file and install it:

```sh
  cd backend-flask
  pip install -r requirements.txt
```


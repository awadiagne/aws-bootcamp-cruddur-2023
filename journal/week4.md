# Week 4 — Postgres and RDS

## Provision RDS Instance

- To create an RDS instance, let's run the command below:
```sh
aws rds create-db-instance \
  --db-instance-identifier cruddur-db-instance \
  --db-instance-class db.t3.micro \
  --engine postgres \
  --engine-version  14.6 \
  --master-username cruddurroot \
  --master-user-password ************** \
  --allocated-storage 20 \
  --availability-zone us-east-1a \
  --backup-retention-period 0 \
  --port 5432 \
  --no-multi-az \
  --db-name cruddur \
  --storage-type gp2 \
  --publicly-accessible \
  --storage-encrypted \
  --enable-performance-insights \
  --performance-insights-retention-period 7 \
  --no-deletion-protection
```
![DB Instance Created](https://github.com/awadiagne/aws-bootcamp-cruddur-2023/blob/main/journal/screenshots/Week_4/DB_Instance_Created.PNG)

- Stop the RDS instance when you aren't using it.

## Connect to PostgreSQL in local

- Let's connect to PostgreSQL via the psql client cli tool with the host flag to specific localhost.
```
psql -U postgres --host localhost
```
- Below are common Postgres commands:

```sql
\x on -- expanded display when looking at data
\q -- Quit PSQL
\l -- List all databases
\c database_name -- Connect to a specific database
\dt -- List all tables in the current database
\d table_name -- Describe a specific table
\du -- List all users and their roles
\dn -- List all schemas in the current database
CREATE DATABASE database_name; -- Create a new database
DROP DATABASE database_name; -- Delete a database
CREATE TABLE table_name (column1 datatype1, column2 datatype2, ...); -- Create a new table
DROP TABLE table_name; -- Delete a table
SELECT column1, column2, ... FROM table_name WHERE condition; -- Select data from a table
INSERT INTO table_name (column1, column2, ...) VALUES (value1, value2, ...); -- Insert data into a table
UPDATE table_name SET column1 = value1, column2 = value2, ... WHERE condition; -- Update data in a table
DELETE FROM table_name WHERE condition; -- Delete data from a table
```

## Create (and dropping) our database

- We can use the createdb command to create our database:
Ref: https://www.postgresql.org/docs/current/app-createdb.html

```
createdb cruddur -h localhost -U postgres
```

![Local DB Created](https://github.com/awadiagne/aws-bootcamp-cruddur-2023/blob/main/journal/screenshots/Week_4/Local_DB_Created.PNG)

- Let's verify that it's created and then drop it: 
```sh
psql -U postgres -h localhost
```
```sql
\l
DROP database cruddur;
```

- We can also create the database directly within the PSQL client with this command:

```sql
CREATE database cruddur;
```

## Import Script

- We'll create a new SQL file called `schema.sql`and we'll place it in `backend-flask/db`. Then, after completing it, we'll import the schema into our DB.

- Let's export our connection URL as an env variable to use it directly instead of having to type it:

```sh
export CONNECTION_URL="postgresql://postgres:password@localhost:5432/cruddur"
gp env CONNECTION_URL="postgresql://postgres:password@localhost:5432/cruddur"
psql $CONNECTION_URL
```
```sh
export PROD_CONNECTION_URL="postgresql://cruddurroot:passer123@cruddur-db-instance.cit7lutnkfzz.us-east-1.rds.amazonaws.com:5432/cruddur"
gp env PROD_CONNECTION_URL="postgresql://cruddurroot:passer123@cruddur-db-instance.cit7lutnkfzz.us-east-1.rds.amazonaws.com:5432/cruddur"
psql $PROD_CONNECTION_URL
```

## Add UUID Extension

- We are going to have Postgres generate out UUIDs. Let's add this command to our schema.sql to use that extension:

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

- Now, let's import the schema.sql script and see the result:
```
cd backend-flask
psql cruddur < db/schema.sql -h localhost -U postgres
```
![Create Extension](https://github.com/awadiagne/aws-bootcamp-cruddur-2023/blob/main/journal/screenshots/Week_4/Create_Extension.PNG)

## Create our tables

- Let's create the tables for users and activities:
```sql
DROP TABLE IF EXISTS public.users;
DROP TABLE IF EXISTS public.activities;

CREATE TABLE public.users (
  uuid UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  display_name text,
  handle text
  cognito_user_id text,
  created_at TIMESTAMP default current_timestamp NOT NULL
);

CREATE TABLE public.activities (
  uuid UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  message text NOT NULL,
  replies_count integer DEFAULT 0,
  reposts_count integer DEFAULT 0,
  likes_count integer DEFAULT 0,
  reply_to_activity_uuid integer,
  expires_at TIMESTAMP,
  created_at TIMESTAMP default current_timestamp NOT NULL
);
```

## Create our triggers

- Then, we create the triggers on updating users and activities:

```sql
DROP TRIGGER IF EXISTS trig_users_updated_at ON users;
DROP TRIGGER IF EXISTS trig_activities_updated_at ON activities;

DROP FUNCTION IF EXISTS func_updated_at();
CREATE FUNCTION func_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER trig_users_updated_at 
BEFORE UPDATE ON users 
FOR EACH ROW EXECUTE PROCEDURE func_updated_at();
CREATE TRIGGER trig_activities_updated_at 
BEFORE UPDATE ON activities 
FOR EACH ROW EXECUTE PROCEDURE func_updated_at();
```

## Shell Script to Connect to DB

For things we commonly need to do we can create a new directory called `bin`

- We'll create an new folder called `bin` to hold all our bash scripts.

```sh
mkdir /workspace/aws-bootcamp-cruddur-2023/backend-flask/bin
```

- We'll create a new bash script `bin/db-connect` to connect to the DB

```sh
#! /usr/bin/bash

psql $CONNECTION_URL
```

- We'll make it executable:

```sh
chmod u+x bin/db-connect
```

- To execute the script:
```sh
./bin/db-connect
```

## Shell script to drop the database

- Let's now write the bash script to drop the DB: `backend-flask/bin/db-drop`. We'll remove the string cruddur at the end of the env var because we can't drop a DB we're already connected to:

```sh
#! /usr/bin/bash

NO_DB_CONNECTION_URL=$(sed 's/\/cruddur//g' <<<"$CONNECTION_URL")
psql $NO_DB_CONNECTION_URL -c "DROP database cruddur;"
```
Ref: https://askubuntu.com/questions/595269/use-sed-on-a-string-variable-rather-than-a-file

## See what connections we are using

- Let's create the bash script to see the current connections to the DB: `backend-flask/bin/db-sessions`:

```sh
NO_DB_CONNECTION_URL=$(sed 's/\/cruddur//g' <<<"$CONNECTION_URL")
psql $NO_DB_CONNECTION_URL -c "select pid as process_id, \
       usename as user,  \
       datname as db, \
       client_addr, \
       application_name as app,\
       state \
from pg_stat_activity;"
```

- We could have idle connections left open by our DB Explorer extension, try disconnecting and checking again the sessions

## Shell script to create the database

- Let's create the bash script to create the DB in `backend-flask/bin/db-create`:

```sh
#! /usr/bin/bash

NO_DB_CONNECTION_URL=$(sed 's/\/cruddur//g' <<<"$CONNECTION_URL")
createdb cruddur $NO_DB_CONNECTION_URL
```

## Shell script to load the schema

- Let's create the bash script to load the schema into the DB in `backend-flask/bin/db-schema-load`

```sh
#! /usr/bin/bash

schema_path="$(realpath .)/db/schema.sql"

echo $schema_path

NO_DB_CONNECTION_URL=$(sed 's/\/cruddur//g' <<<"$CONNECTION_URL")
psql $NO_DB_CONNECTION_URL cruddur < $schema_path
```

## Shell script to load the seed data

- Let's create the bash script to load the seed data into the DB in `backend-flask/bin/db-seed`

```sh
#! /usr/bin/bash

schema_path="$(realpath .)/db/schema.sql"

echo $schema_path

psql $CONNECTION_URL cruddur < $schema_path
```

## Easily setup (reset) everything for our database

- Let's create the bash script to setup the whole DB in `backend-flask/bin/db-setup`

```sh
#! /usr/bin/bash
-e # stop if it fails at any point

bin_path="$(realpath .)/bin"

source "$bin_path/db-drop"
source "$bin_path/db-create"
source "$bin_path/db-schema-load"
source "$bin_path/db-seed"
```

## Make prints nicer

- Let's make prints for our shell scripts coloured so we can see what we're doing.

https://stackoverflow.com/questions/5947742/how-to-change-the-output-color-of-echo-in-linux
Let's add these lines to the scripts:

```sh
CYAN='\033[1;36m'
NO_COLOR='\033[0m'
LABEL="db-schema-load"
printf "${CYAN}== ${LABEL}${NO_COLOR}\n"
```

## Seed Data into users and activities

- Now, let's seed some data into our two tables created in schema.sql. To do so, we'll create another sql file `backend-flask/db/seeq.sql` with this content:

```sql
INSERT INTO public.users (display_name, handle, cognito_user_id)
VALUES
  ('Andrew Brown', 'andrewbrown' ,'MOCK'),
  ('Andrew Bayko', 'bayko' ,'MOCK');

INSERT INTO public.activities (user_uuid, message, expires_at)
VALUES
  (
    (SELECT uuid from public.users WHERE users.handle = 'andrewbrown' LIMIT 1),
    'This was imported as seed data!',
    current_timestamp + interval '10 day'
  )
```
- See in the result in the local DB:

![Users Seed](https://github.com/awadiagne/aws-bootcamp-cruddur-2023/blob/main/journal/screenshots/Week_4/Users_Seed.PNG)

![Activities Seed](https://github.com/awadiagne/aws-bootcamp-cruddur-2023/blob/main/journal/screenshots/Week_4/Activities_Seed.PNG)

## Install Postgres Client

Now, we want to implement a postgres client for python using a connection pool.

- We need to set the env var for our backend-flask application:

```yml
  backend-flask:
    environment:
      CONNECTION_URL: "${CONNECTION_URL}"
```

- We'll add the following to our `backend-flask/requirements.txt` and install them:

```
psycopg[binary]
psycopg[pool]
```
```sh
pip install -r requirements.txt
```

## DB Object and Connection Pool

- Let's create a file `lib/db.py` and use it to connect to the DB through a conection pool

```py
from psycopg_pool import ConnectionPool
import os

connection_url = os.getenv("CONNECTION_URL")
pool = ConnectionPool(connection_url)

def query_wrap_object(template):
  sql = '''
  (SELECT COALESCE(row_to_json(object_row),'{}'::json) FROM (
  {template}
  ) object_row);
  '''

def query_wrap_array(template):
  sql = '''
  (SELECT COALESCE(array_to_json(array_agg(row_to_json(array_row))),'[]'::json) FROM (
  {template}
  ) array_row);
  '''
```

- In our home activities, we'll replace our mock endpoint with real api call:

```py
from lib.db import pool, query_wrap_array

      sql = query_wrap_array("""
      SELECT
        activities.uuid,
        users.display_name,
        users.handle,
        activities.message,
        activities.replies_count,
        activities.reposts_count,
        activities.likes_count,
        activities.reply_to_activity_uuid,
        activities.expires_at,
        activities.created_at
      FROM public.activities
      LEFT JOIN public.users ON users.uuid = activities.user_uuid
      ORDER BY activities.created_at DESC
      """)
      print(sql)
      with pool.connection() as conn:
        with conn.cursor() as cur:
          cur.execute(sql)
          # this will return a tuple
          # the first field being the data
          json = cur.fetchall()
      return json
```

- Now we can see on the frontend that the seeded data is being displayed

![Seeded Data Displayed](https://github.com/awadiagne/aws-bootcamp-cruddur-2023/blob/main/journal/screenshots/Week_4/Seeded_Data_Displayed.PNG)
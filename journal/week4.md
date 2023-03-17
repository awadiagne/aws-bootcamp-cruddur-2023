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

- We'll create a new SQL file called `schema.sql`and we'll place it in `backend-flask/db`. Then, we'll import the schema into our DB:
```
psql cruddur < db/schema.sql -h localhost -U postgres
```

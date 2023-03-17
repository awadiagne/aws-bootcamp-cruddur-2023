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

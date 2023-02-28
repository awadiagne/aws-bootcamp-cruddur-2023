# Week 1 — App Containerization

## Install VSCode Docker Extension
Follow this link to download the extension : https://code.visualstudio.com/docs/containers/overview

## Backend Containerization

### Making sure the app is running correctly

- Go to the backend directory
- Set the environment variables
- Install the required libraries for the app
- Run the app

```sh
    cd backend-flask
    export FRONTEND_URL="*"
    export BACKEND_URL="*"
    pip install --upgrade pip 
    pip install -r requirements.txt
    python3 -m flask run --host=0.0.0.0 --port=4567
```

The endpoint is working by following this link: http:localhost:4567/api/activities/home 

![Flask App Running](https://github.com/awadiagne/aws-bootcamp-cruddur-2023/blob/main/journal/screenshots/Week_1/Run_Flask_App.png)

### Create the Dockerfile

```sh
    touch Dockerfile
```

```dockerfile
FROM python:3.10-slim-buster

WORKDIR /backend-flask

COPY requirements.txt requirements.txt
RUN pip3 install -r requirements.txt

COPY . .

ENV FLASK_ENV=development

EXPOSE ${PORT}
CMD [ "python3", "-m" , "flask", "run", "--host=0.0.0.0", "--port=4567"]
```

### Building the Container

```sh
docker build -t  backend-flask ./backend-flask
```

### Running the Container

- Make sure that the FRONTEND_URL and  BACKEND_URL environment variables are well set in our local OS
- Run the container on port 4567 in interactive mode, remove after on stop and set these environment variables.

```sh
    echo $FRONTEND_URL
    echo $BACKEND_URL
    docker run --rm -p 4567:4567 -it -e FRONTEND_URL -e BACKEND_URL backend-flask
```

Also tried to run it in a detached mode and get the container id into an env variable:
```sh
    CONTAINER_ID=$(docker run --rm -p 4567:4567 -d -e FRONTEND_URL -e BACKEND_URL backend-flask)
```

![Container App Running](https://github.com/awadiagne/aws-bootcamp-cruddur-2023/blob/main/journal/screenshots/Week_1/Run_Container_App.png)

### Get Running Container Ids

```sh
docker ps
```
![Get Running Containers](https://github.com/awadiagne/aws-bootcamp-cruddur-2023/blob/main/journal/screenshots/Week_1/Get_Running_Container_Ids.png)

### Get Docker Images 

```sh
docker images
```
![Get Docker Images](https://github.com/awadiagne/aws-bootcamp-cruddur-2023/blob/main/journal/screenshots/Week_1/Get_Docker_Images.png)

### Testing Flask app with curl

```sh
curl -X GET http://localhost:4567/api/activities/home -H "Accept: application/json" -H "Content-Type: application/json"
```
![Backend Curl Test](https://github.com/awadiagne/aws-bootcamp-cruddur-2023/blob/main/journal/screenshots/Week_1/Backend_Curl_Test.png)

### Check Container Logs

```sh
docker logs backend-flask -f
docker logs $CONTAINER_ID -f
```

###  Debugging adjacent containers with other containers

```sh
docker run --rm -it curlimages/curl -X GET http://localhost:4567/api/activities/home -H "Accept: application/json" -H "Content-Type: application/json"
```
![Curl Images Test](https://github.com/awadiagne/aws-bootcamp-cruddur-2023/blob/main/journal/screenshots/Week_1/Curl_Images_Test.png)

### Using busybox

```sh
docker run --rm -it busybox
```
![Busybox](https://github.com/awadiagne/aws-bootcamp-cruddur-2023/blob/main/journal/screenshots/Week_1/Busybox.png)

###  Access a Container

```sh
docker exec -it $CONTAINER_ID /bin/bash
```
![Access a Container](https://github.com/awadiagne/aws-bootcamp-cruddur-2023/blob/main/journal/screenshots/Week_1/Access_Container.png)

### Deleting the Image

```sh
docker image rm backend-flask
```
![Remove the image](https://github.com/awadiagne/aws-bootcamp-cruddur-2023/blob/main/journal/screenshots/Week_1/Remove_image.png)

### Overriding Ports

```sh
FLASK_ENV=production PORT=8080 docker run -p 4567:4567 -it backend-flask
```

## Frontend Containerization

### Instaling node modules

Run NPM Install before building the container

```
cd frontend-react-js
npm i
```

### Creating Docker File

Create a file here: `frontend-react-js/Dockerfile`

```dockerfile
FROM node:16.18

ENV PORT=3000

COPY . /frontend-react-js
WORKDIR /frontend-react-js
RUN npm install
EXPOSE ${PORT}
CMD ["npm", "start"]
```

### Building the Container

```sh
docker build -t frontend-react-js .
```

### Running the Container

```sh
docker run -p 3000:3000 -d frontend-react-js
```

## Managing Multiple Containers

### Create a docker-compose file

I created `docker-compose.yml` at the root of the project with this content:

```yaml
version: "3.8"
services:
  backend-flask:
    environment:
      FRONTEND_URL: "https://3000-${GITPOD_WORKSPACE_ID}.${GITPOD_WORKSPACE_CLUSTER_HOST}"
      BACKEND_URL: "https://4567-${GITPOD_WORKSPACE_ID}.${GITPOD_WORKSPACE_CLUSTER_HOST}"
    build: ./backend-flask
    ports:
      - "4567:4567"
    volumes:
      - ./backend-flask:/backend-flask
  frontend-react-js:
    environment:
      REACT_APP_BACKEND_URL: "https://4567-${GITPOD_WORKSPACE_ID}.${GITPOD_WORKSPACE_CLUSTER_HOST}"
    build: ./frontend-react-js
    ports:
      - "3000:3000"
    volumes:
      - ./frontend-react-js:/frontend-react-js

# the name flag is a hack to change the default prepend folder
# name when outputting the image names
networks: 
  internal-network:
    driver: bridge
    name: cruddur
```

## Adding DynamoDB Local and Postgres

We are going to use Postgres and DynamoDB local in future labs
We can bring them in as containers and reference them externally

Lets add the following lines into our existing docker compose file:

### For Postgres

```yaml
services:
  db:
    image: postgres:13-alpine
    restart: always
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=password
    ports:
      - '5432:5432'
    volumes: 
      - db:/var/lib/postgresql/data
volumes:
  db:
    driver: local
```

To install the postgres client into Gitpod, let's add these line in gitpod.yml

```sh
  - name: postgres
    init: |
      curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc|sudo gpg --dearmor -o /etc/apt/trusted.gpg.d/postgresql.gpg
      echo "deb http://apt.postgresql.org/pub/repos/apt/ `lsb_release -cs`-pgdg main" |sudo tee  /etc/apt/sources.list.d/pgdg.list
      sudo apt update
      sudo apt install -y postgresql-client-13 libpq-dev
```

### DynamoDB Local

```yaml
services:
  dynamodb-local:
    # https://stackoverflow.com/questions/67533058/persist-local-dynamodb-data-in-volumes-lack-permission-unable-to-open-databa
    # We needed to add user:root to get this working.
    user: root
    command: "-jar DynamoDBLocal.jar -sharedDb -dbPath ./data"
    image: "amazon/dynamodb-local:latest"
    container_name: dynamodb-local
    ports:
      - "8000:8000"
    volumes:
      - "./docker/dynamodb:/home/dynamodblocal/data"
    working_dir: /home/dynamodblocal
```

Example of using DynamoDB local : https://github.com/100DaysOfCloud/challenge-dynamodb-local


## Volumes

directory volume mapping

```yaml
volumes: 
- "./docker/dynamodb:/home/dynamodblocal/data"
```

named volume mapping

```yaml
volumes: 
  - db:/var/lib/postgresql/data

volumes:
  db:
    driver: local
```

Then, we can build and run the containers with docker compose:
```sh
docker compose up
```

![Docker Compose Up](https://github.com/awadiagne/aws-bootcamp-cruddur-2023/blob/main/journal/screenshots/Week_1/Docker_Compose_Up.png)
# Week 2 — Distributed Tracing

## X-Ray

### Instrument AWS X-Ray for Flask

```sh
export AWS_REGION="us-east-1"
gp env AWS_REGION="us-east-1"
```

- Add to the `backend-flask/requirements.txt`
```py
aws-xray-sdk
```

- Install python dependencies
```sh
pip install -r requirements.txt
```

- Add to `app.py`
```py
from aws_xray_sdk.core import xray_recorder
from aws_xray_sdk.ext.flask.middleware import XRayMiddleware

### Add these lines after the definition of app
xray_url = os.getenv("AWS_XRAY_URL")
xray_recorder.configure(service='Cruddur', dynamic_naming=xray_url)
XRayMiddleware(app, xray_recorder)
```

### Setup AWS X-Ray Resources
**AWS X-Ray** provides a complete view of requests as they travel through your application and filters visual data across payloads, functions, traces, services, APIs, and more with no-code and low-code motions.
The X-Ray SDK and AWS services that support active tracing with sampling configuration use sampling rules to determine which requests to record.

- Add `aws/json/xray.json` that will represent our sampling rule
```json
{
  "SamplingRule": {
      "RuleName": "Cruddur",
      "ResourceARN": "*",
      "Priority": 9000,
      "FixedRate": 0.1,
      "ReservoirSize": 5,
      "ServiceName": "Cruddur",
      "ServiceType": "*",
      "Host": "*",
      "HTTPMethod": "*",
      "URLPath": "*",
      "Version": 1
  }
}
```

- Create X-Ray group
**Groups** are a collection of traces that are defined by a filter expression. You can use groups to generate additional service graphs and supply Amazon CloudWatch metrics.

Let's create an AWS XRay group

```sh
FLASK_ADDRESS="https://4567-${GITPOD_WORKSPACE_ID}.${GITPOD_WORKSPACE_CLUSTER_HOST}"
aws xray create-group \
   --group-name "Cruddur" \
   --filter-expression "service(\"$FLASK_ADDRESS\") {fault OR error}"
```
![Create XRay Group](https://github.com/awadiagne/aws-bootcamp-cruddur-2023/blob/main/journal/screenshots/Week_2/Create_XRay_Group.PNG)

- Create the **sample rule** described in xray.json:

```sh
aws xray create-sampling-rule --cli-input-json file://aws/json/xray.json
```
![Create Sampling Rule](https://github.com/awadiagne/aws-bootcamp-cruddur-2023/blob/main/journal/screenshots/Week_2/Create_Sampling_Rule.PNG)

Now, we can install XRay daemon. Useful links below: 
[Install X-ray Daemon](https://docs.aws.amazon.com/xray/latest/devguide/xray-daemon.html)
[Github aws-xray-daemon](https://github.com/aws/aws-xray-daemon)
[X-Ray Docker Compose example](https://github.com/marjamis/xray/blob/master/docker-compose.yml)

- Install XRay daemon:
The **AWS X-Ray daemon** is a software application that listens for traffic on UDP port 2000, gathers raw segment data, and relays it to the AWS X-Ray API.

```sh
 wget https://s3.us-east-2.amazonaws.com/aws-xray-assets.us-east-2/xray-daemon/aws-xray-daemon-3.x.deb
 sudo dpkg -i **.deb
 ```

### Add XRay Daemon Service to Docker Compose

```yml
  xray-daemon:
    image: "amazon/aws-xray-daemon"
    environment:
      AWS_ACCESS_KEY_ID: "${AWS_ACCESS_KEY_ID}"
      AWS_SECRET_ACCESS_KEY: "${AWS_SECRET_ACCESS_KEY}"
      AWS_REGION: "us-east-1"
    command:
      - "xray -o -b xray-daemon:2000"
    ports:
      - 2000:2000/udp
```

- We need to add the following env vars to our backend-flask in our `docker-compose.yml` file
```yml
      AWS_XRAY_URL: "*4567-${GITPOD_WORKSPACE_ID}.${GITPOD_WORKSPACE_CLUSTER_HOST}*"
      AWS_XRAY_DAEMON_ADDRESS: "xray-daemon:2000"
```

### Check service data for last 10 minutes

```sh
EPOCH=$(date +%s)
aws xray get-service-graph --start-time $(($EPOCH-600)) --end-time $EPOCH
```
![XRay Graph](https://github.com/awadiagne/aws-bootcamp-cruddur-2023/blob/main/journal/screenshots/Week_2/XRay_Graph.PNG)

![XRay Analytics](https://github.com/awadiagne/aws-bootcamp-cruddur-2023/blob/main/journal/screenshots/Week_2/XRay_Analytics.PNG)

![XRay Sending Logs](https://github.com/awadiagne/aws-bootcamp-cruddur-2023/blob/main/journal/screenshots/Week_2/XRay_Sending_Logs.PNG)

![XRay Traces](https://github.com/awadiagne/aws-bootcamp-cruddur-2023/blob/main/journal/screenshots/Week_2/XRay_Traces.PNG)

## HoneyComb
**OpenTelemetry** is a collection of tools, APIs, and SDKs used to instrument, generate, collect, and export telemetry data (metrics, logs, and traces) to help in analyzing software’s performance and behavior.

When creating a new dataset in Honeycomb it will provide all these installation instructions.

- Let's add the following files to our `requirements.txt`
```
opentelemetry-api 
opentelemetry-sdk 
opentelemetry-exporter-otlp-proto-http 
opentelemetry-instrumentation-flask 
opentelemetry-instrumentation-requests
```

- Let's run pip install to install them
```sh
pip install -r requirements.txt
```

- Let's update `app.py` as follows to take opentelemetry into account:
```py
from opentelemetry import trace
from opentelemetry.instrumentation.flask import FlaskInstrumentor
from opentelemetry.instrumentation.requests import RequestsInstrumentor
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
```

- Let's initialize tracing and an exporter that can send data to **Honeycomb**
```py
provider = TracerProvider()
processor = BatchSpanProcessor(OTLPSpanExporter())
provider.add_span_processor(processor)
trace.set_tracer_provider(provider)
tracer = trace.get_tracer(__name__)
```

- Let's initialize automatic instrumentation with Flask
```py
app = Flask(__name__)
FlaskInstrumentor().instrument_app(app)
RequestsInstrumentor().instrument()
```

- Then, we add the following Env Vars to `backend-flask` in docker compose:
```yml
OTEL_EXPORTER_OTLP_ENDPOINT: "https://api.honeycomb.io"
OTEL_EXPORTER_OTLP_HEADERS: "x-honeycomb-team=${HONEYCOMB_API_KEY}"
OTEL_SERVICE_NAME: "${HONEYCOMB_SERVICE_NAME}"
```

- We grab the API key from our honeycomb account and export it as env variable:
```sh
export HONEYCOMB_API_KEY="******************"
export HONEYCOMB_SERVICE_NAME="Cruddur"
gp env HONEYCOMB_API_KEY="******************"
gp env HONEYCOMB_SERVICE_NAME="Cruddur"
```

## CloudWatch Logs

- Add to the `requirements.txt`
```
watchtower
```

```sh
pip install -r requirements.txt
```

- Add in `app.py`:
```
import watchtower
import logging
from time import strftime
```

- Configuring Logger to Use **CloudWatch**
```py
LOGGER = logging.getLogger(__name__)
LOGGER.setLevel(logging.DEBUG)
console_handler = logging.StreamHandler()
cw_handler = watchtower.CloudWatchLogHandler(log_group='cruddur')
LOGGER.addHandler(console_handler)
LOGGER.addHandler(cw_handler)
LOGGER.info("some message")
```

- Add a new endpoint for logging
```py
@app.after_request
def after_request(response):
    timestamp = strftime('[%Y-%b-%d %H:%M]')
    LOGGER.error('%s %s %s %s %s %s', timestamp, request.remote_addr, request.method, request.scheme, request.full_path, response.status)
    return response
```

- We'll log something in the notification API endpoint for example
```py
LOGGER.info('Hello Cloudwatch! from  /api/activities/home')
```

- Set the env vars in the backend-flask for `docker-compose.yml`
```yml
      AWS_DEFAULT_REGION: "${AWS_DEFAULT_REGION}"
      AWS_ACCESS_KEY_ID: "${AWS_ACCESS_KEY_ID}"
      AWS_SECRET_ACCESS_KEY: "${AWS_SECRET_ACCESS_KEY}"
```

![Cloudwatch Logs](https://github.com/awadiagne/aws-bootcamp-cruddur-2023/blob/main/journal/screenshots/Week_2/Cloudwatch_Logs.PNG)

## Rollbar

[Rollbar]https://rollbar.com/

### Create a new project in Rollbar called `Cruddur`

- Add to `requirements.txt`
```
blinker
rollbar
```

- Install deps
```sh
pip install -r requirements.txt
```

- We need to set our access token
```sh
export ROLLBAR_ACCESS_TOKEN=""
gp env ROLLBAR_ACCESS_TOKEN=""
```

- Now, we add to backend-flask for `docker-compose.yml`
```yml
ROLLBAR_ACCESS_TOKEN: "${ROLLBAR_ACCESS_TOKEN}"
```

- Import for Rollbar
```py
import rollbar
import rollbar.contrib.flask
from flask import got_request_exception
```

- Let's initialize rollbar module
```py
rollbar_access_token = os.getenv('ROLLBAR_ACCESS_TOKEN')
@app.before_first_request
def init_rollbar():
    """init rollbar module"""
    rollbar.init(
        # access token
        rollbar_access_token,
        # environment name
        'production',
        # server root directory, makes tracebacks prettier
        root=os.path.dirname(os.path.realpath(__file__)),
        # flask already sets up logging
        allow_logging_basic_config=False)

    # send exceptions from `app` to rollbar, using flask's signal system.
    got_request_exception.connect(rollbar.contrib.flask.report_exception, app)
```

- Now, let's add an endpoint just for testing rollbar to `app.py`
```py
@app.route('/rollbar/test')
def rollbar_test():
    rollbar.report_message('Hello World!', 'warning')
    return "Hello World!"
```

[Rollbar Flask Example](https://github.com/rollbar/rollbar-flask-example/blob/master/hello.py)

### Results on Honeycomb

![Honeycomb Logs](https://github.com/awadiagne/aws-bootcamp-cruddur-2023/blob/main/journal/screenshots/Week_2/Honeycomb_Logs.PNG)

![Honeycomb Logs With Spans](https://github.com/awadiagne/aws-bootcamp-cruddur-2023/blob/main/journal/screenshots/Week_2/Honeycomb_Logs_With_Spans.PNG)

![Honeycomb Logs With Attributes](https://github.com/awadiagne/aws-bootcamp-cruddur-2023/blob/main/journal/screenshots/Week_2/Honeycomb_Logs_With_Attributes.PNG)

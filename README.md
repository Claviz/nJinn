# nJinn [![Build Status](https://travis-ci.org/Claviz/nJinn.svg?branch=master)](https://travis-ci.org/Claviz/nJinn) [![codecov](https://codecov.io/gh/Claviz/nJinn/branch/master/graph/badge.svg)](https://codecov.io/gh/Claviz/nJinn) ![npm](https://img.shields.io/npm/v/njinn.svg)

Build and run serverless JS applications.

## Installation & Usage

### CLI
nJinn can be run without any installation:

`npx njinn -p 3033`

Server will be available at http://localhost:3033

### API
You can also use nJinn inside your project:

`npm install njinn`

Usage:

```js
const nJinn = require('njinn');

(async () => {
    await nJinn.startServer({ port: 3033 });
})();
```

## Server API

### Save script

`POST` `/saveScript`

Body:

```json
{
    "id": "sum.js",
    "script": "module.exports = (context) => { return context.a + context.b; }"
}
```

### Execute script

`POST` `/executeScript`

Body:

```json
{
    "id": "sum.js",
    "context": {
        "a": 2,
        "b": 2
    }
}
```

### Install packages

`POST` `/installPackages`

Body:

```json
[
    {
        "package": "moment",
        "version": "latest"
    }
]
```

### Queue jobs

Runs functions in the background and returns result to the specified webhook.

`POST` `/queueJobs`

Body:

```json
[
    {
        "id": "abc.js",
        "webhook": { "url": "http://localhost:3034/webhook" }
    }
]
```

## Testing

Tests can be run by using `docker-compose -f docker-compose.test.yml up --abort-on-container-exit --exit-code-from test` command.
import 'dotenv/config'
import convict from 'convict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dirname = path.dirname(fileURLToPath(import.meta.url))

const isProduction = process.env.NODE_ENV === 'production'
const isDev = process.env.NODE_ENV === 'development'
const isTest = process.env.NODE_ENV === 'test'
const config = convict({
  serviceVersion: {
    doc: 'The service version, this variable is injected into your docker container in CDP environments',
    format: String,
    nullable: true,
    default: null,
    env: 'SERVICE_VERSION'
  },
  env: {
    doc: 'The application environment.',
    format: ['production', 'development', 'test'],
    default: 'development',
    env: 'NODE_ENV'
  },
  port: {
    doc: 'The port to bind.',
    format: 'port',
    default: 3001,
    env: 'PORT'
  },
  serviceName: {
    doc: 'Api Service Name',
    format: String,
    default: 'farming-grants-agreements-api'
  },
  root: {
    doc: 'Project root',
    format: String,
    default: path.resolve(dirname, '../..')
  },
  isProduction: {
    doc: 'If this application running in the production environment',
    format: Boolean,
    default: isProduction
  },
  isDevelopment: {
    doc: 'If this application running in the development environment',
    format: Boolean,
    default: isDev
  },
  isTest: {
    doc: 'If this application running in the test environment',
    format: Boolean,
    default: isTest
  },
  log: {
    enabled: {
      doc: 'Is logging enabled',
      format: Boolean,
      default: !isTest,
      env: 'LOG_ENABLED'
    },
    level: {
      doc: 'Logging level',
      format: ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'],
      default: 'info',
      env: 'LOG_LEVEL'
    },
    format: {
      doc: 'Format to output logs in.',
      format: ['ecs', 'pino-pretty'],
      default: isProduction ? 'ecs' : 'pino-pretty',
      env: 'LOG_FORMAT'
    },
    redact: {
      doc: 'Log paths to redact',
      format: Array,
      default: isProduction
        ? ['req.headers.authorization', 'req.headers.cookie', 'res.headers']
        : ['req', 'res', 'responseTime']
    }
  },
  sqs: {
    awsRegion: {
      doc: 'AWS region',
      format: String,
      default: 'eu-west-2',
      env: 'AWS_REGION'
    },
    endpoint: {
      doc: 'AWS SQS endpoint',
      format: String,
      default: 'http://localhost:4566',
      env: 'SQS_ENDPOINT'
    },
    queueUrl: {
      doc: 'Queue URL',
      format: String,
      default: 'http://localhost:4566/000000000000/create_agreement',
      env: 'QUEUE_URL'
    },
    interval: {
      doc: 'SQS Interval',
      format: Number,
      default: 10000,
      env: 'SQS_INTERVAL'
    },
    queueName: {
      doc: 'Queue Name',
      format: String,
      default: 'create_agreement',
      env: 'QUEUE_NAME'
    },
    maxMessages: {
      doc: 'Max number of messages to receive from SQS',
      format: Number,
      default: 1,
      env: 'MAX_NUMBER_OF_MESSAGES'
    },
    visibilityTimeout: {
      doc: 'Visibility timeout for SQS messages',
      format: Number,
      default: 10,
      env: 'VISIBILITY_TIMEOUT'
    },
    waitTime: {
      doc: 'Wait time for SQS messages',
      format: Number,
      default: 5,
      env: 'WAIT_TIME_SECONDS'
    }
  },
  mongoUri: {
    doc: 'URI for mongodb',
    format: String,
    default: 'mongodb://127.0.0.1:27017/',
    env: 'MONGO_URI'
  },
  mongoDatabase: {
    doc: 'database for mongodb',
    format: String,
    default: 'farming-grants-agreements-api',
    env: 'MONGO_DATABASE'
  },
  seedDb: {
    doc: 'Seed the database',
    format: Boolean,
    default: false,
    env: 'SEED_DB'
  },
  httpProxy: {
    doc: 'HTTP Proxy',
    format: String,
    nullable: true,
    default: null,
    env: 'HTTP_PROXY'
  },
  isSecureContextEnabled: {
    doc: 'Enable Secure Context',
    format: Boolean,
    default: isProduction,
    env: 'ENABLE_SECURE_CONTEXT'
  },
  isMetricsEnabled: {
    doc: 'Enable metrics reporting',
    format: Boolean,
    default: isProduction,
    env: 'ENABLE_METRICS'
  },
  tracing: {
    header: {
      doc: 'Which header to track',
      format: String,
      default: 'x-cdp-request-id',
      env: 'TRACING_HEADER'
    }
  },
  paymentHub: {
    uri: {
      doc: 'URI for payment hub service bus',
      format: String,
      default: 'https://paymenthub/',
      env: 'PAYMENT_HUB_URI'
    },
    ttl: {
      doc: 'Time to live for payment hub access token',
      format: 'nat',
      default: 86400,
      env: 'PAYMENT_HUB_TTL'
    },
    keyName: {
      doc: 'Key name for payment hub service bus',
      format: String,
      default: 'MyManagedAccessKey',
      env: 'PAYMENT_HUB_SA_KEY_NAME'
    },
    key: {
      doc: 'Key for payment hub service bus',
      format: String,
      default: 'my_key',
      sensitive: true,
      env: 'PAYMENT_HUB_SA_KEY'
    }
  }
})

config.validate({ allowed: 'strict' })

export { config }

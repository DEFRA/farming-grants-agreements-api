import 'dotenv/config'
import convict from 'convict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dirname = path.dirname(fileURLToPath(import.meta.url))

const oneWeekMs = 604800000

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
  staticCacheTimeout: {
    doc: 'Static cache timeout in milliseconds',
    format: Number,
    default: oneWeekMs,
    env: 'STATIC_CACHE_TIMEOUT'
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
  assetPath: {
    doc: 'Asset path',
    format: String,
    default: '/public',
    env: 'ASSET_PATH'
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
  isPaymentHubLogging: {
    doc: 'If logging of payment hub requests is enabled',
    format: Boolean,
    default: false,
    env: 'PAYMENT_HUB_LOGGING'
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
  aws: {
    region: {
      doc: 'AWS region',
      format: String,
      default: 'eu-west-2',
      env: 'AWS_REGION'
    },
    accessKeyId: {
      doc: 'AWS access key ID',
      format: String,
      default: 'test',
      env: 'AWS_ACCESS_KEY_ID'
    },
    secretAccessKey: {
      doc: 'AWS secret access key',
      format: String,
      default: 'test',
      env: 'AWS_SECRET_ACCESS_KEY'
    },
    sns: {
      endpoint: {
        doc: 'AWS SNS endpoint',
        format: String,
        default: 'http://localhost:4566',
        env: 'SNS_ENDPOINT'
      },
      maxAttempts: {
        doc: 'AWS SNS max publish attempts before error',
        format: Number,
        default: 3,
        env: 'SNS_MAX_ATTEMPTS'
      },
      eventSource: {
        doc: 'AWS SNS Cloud event source for emitted events',
        format: String,
        default: 'urn:service:agreement',
        env: 'SNS_EVENT_SOURCE'
      },
      topic: {
        offerCreated: {
          arn: {
            doc: 'AWS SNS Topic ARN for Offer Created events',
            format: String,
            default: 'arn:aws:sns:eu-west-2:000000000000:offer_created',
            env: 'SNS_TOPIC_ARN_OFFER_CREATED'
          },
          type: {
            doc: 'AWS SNS Topic type for Offer Created events',
            format: String,
            default: 'io.onsite.agreement.offer.created',
            env: 'SNS_TOPIC_TYPE_OFFER_CREATED'
          }
        },
        offerAccepted: {
          arn: {
            doc: 'AWS SNS Topic ARN for Offer Accepted events',
            format: String,
            default: 'arn:aws:sns:eu-west-2:000000000000:agreement_accepted',
            env: 'SNS_TOPIC_ARN_OFFER_ACCEPTED'
          },
          type: {
            doc: 'AWS SNS Topic type for Offer Accepted events',
            format: String,
            default: 'io.onsite.agreement.offer.accepted',
            env: 'SNS_TOPIC_TYPE_OFFER_ACCEPTED'
          }
        }
      }
    }
  },
  sqs: {
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
  jwtSecret: {
    doc: 'JWT Secret',
    format: String,
    default: 'default-agreements-jwt-secret',
    env: 'AGREEMENTS_JWT_SECRET'
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
  },
  nunjucks: {
    watch: {
      doc: 'Whether to watch templates for changes',
      format: Boolean,
      default: isDev,
      env: 'NUNJUCKS_WATCH'
    },
    noCache: {
      doc: 'Disable template caching',
      format: Boolean,
      default: !isProduction,
      env: 'NUNJUCKS_NO_CACHE'
    }
  },
  featureFlags: {
    seedDb: {
      doc: 'Seed the database',
      format: Boolean,
      default: false,
      env: 'SEED_DB'
    },
    testEndpoints: {
      doc: 'Enable test endpoints',
      format: Boolean,
      default: false,
      env: 'ENABLE_TEST_ENDPOINTS'
    },
    isJwtEnabled: {
      doc: 'Enable JWT authentication validation',
      format: Boolean,
      default: true,
      env: 'JWT_ENABLED'
    }
  }
})

config.validate({ allowed: 'strict' })

export { config }

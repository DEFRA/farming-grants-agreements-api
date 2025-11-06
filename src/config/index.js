import 'dotenv/config'
import convict from 'convict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dirname = path.dirname(fileURLToPath(import.meta.url))

const isProduction = process.env.NODE_ENV === 'production'
const isDev = process.env.NODE_ENV === 'development'
const isTest = process.env.NODE_ENV === 'test'
const STRICT_BOOLEAN_FORMAT = 'strict-boolean'

convict.addFormat({
  name: STRICT_BOOLEAN_FORMAT,
  validate: (val) => {
    if (val !== true && val !== false) {
      throw new Error('must be a boolean true/false')
    }
  },
  coerce: (val) => {
    if (typeof val === 'string') {
      const trimmedValue = val.trim().toLowerCase()
      if (trimmedValue === 'true') {
        return true
      }
      if (trimmedValue === 'false') {
        return false
      }
      return val
    }
    return val
  }
})

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
  serviceTitle: {
    doc: 'Service Title',
    format: String,
    default: 'Farm payments'
  },
  root: {
    doc: 'Project root',
    format: String,
    default: path.resolve(dirname, '../..')
  },
  isProduction: {
    doc: 'If this application running in the production environment',
    format: STRICT_BOOLEAN_FORMAT,
    default: isProduction
  },
  isDevelopment: {
    doc: 'If this application running in the development environment',
    format: STRICT_BOOLEAN_FORMAT,
    default: isDev
  },
  isTest: {
    doc: 'If this application running in the test environment',
    format: STRICT_BOOLEAN_FORMAT,
    default: isTest
  },
  isPaymentHubLogging: {
    doc: 'If logging of payment hub requests is enabled',
    format: STRICT_BOOLEAN_FORMAT,
    default: false,
    env: 'PAYMENT_HUB_LOGGING'
  },
  log: {
    enabled: {
      doc: 'Is logging enabled',
      format: STRICT_BOOLEAN_FORMAT,
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
        agreementStatusUpdate: {
          arn: {
            doc: 'AWS SNS Topic ARN for Agreement status update events',
            format: String,
            default:
              'arn:aws:sns:eu-west-2:000000000000:agreement_status_updated',
            env: 'SNS_TOPIC_ARN_AGREEMENT_STATUS_UPDATED'
          },
          type: {
            doc: 'AWS SNS Topic type for Agreement status update events',
            format: String,
            default: 'io.onsite.agreement.status.updated',
            env: 'SNS_TOPIC_TYPE_AGREEMENT_STATUS_UPDATED'
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
    gasApplicationUpdatedQueueUrl: {
      doc: 'Grants Application Service Queue URL',
      format: String,
      default:
        'http://localhost:4566/000000000000/gas_application_status_updated',
      env: 'SQS_GAS_APPLICATION_STATUS_UPDATED_QUEUE_URL'
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
    format: STRICT_BOOLEAN_FORMAT,
    default: isProduction,
    env: 'ENABLE_SECURE_CONTEXT'
  },
  isMetricsEnabled: {
    doc: 'Enable metrics reporting',
    format: STRICT_BOOLEAN_FORMAT,
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
  googleAnalytics: {
    trackingId: {
      doc: 'Google Analytics tracking ID',
      format: String,
      default: '',
      env: 'GA_TRACKING_ID'
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
  files: {
    s3: {
      bucket: {
        doc: 'S3 bucket where agreement PDFs are stored (created by CDP Platform team, see #cdp-support)',
        format: String,
        default: '',
        env: 'FILES_S3_BUCKET'
      },
      region: {
        doc: 'AWS region for the S3 bucket (CDP uses eu-west-2)',
        format: String,
        default: 'eu-west-2',
        env: 'FILES_S3_REGION'
      },
      baseTermPrefix: {
        doc: 'S3 key prefix for base term retention (10 years)',
        format: String,
        default: 'base',
        env: 'FILES_S3_BASE_TERM_PREFIX'
      },
      extendedTermPrefix: {
        doc: 'S3 key prefix for extended term retention (15 years)',
        format: String,
        default: 'extended',
        env: 'FILES_S3_EXTENDED_TERM_PREFIX'
      },
      maximumTermPrefix: {
        doc: 'S3 key prefix for maximum term retention (20 years)',
        format: String,
        default: 'maximum',
        env: 'FILES_S3_MAXIMUM_TERM_PREFIX'
      },
      baseTermThreshold: {
        doc: 'Threshold in years for base term retention period',
        format: 'nat',
        default: 10,
        env: 'FILES_S3_BASE_TERM_THRESHOLD'
      },
      extendedTermThreshold: {
        doc: 'Threshold in years for extended term retention period',
        format: 'nat',
        default: 15,
        env: 'FILES_S3_EXTENDED_TERM_THRESHOLD'
      },
      maximumTermThreshold: {
        doc: 'Threshold in years for maximum term retention period',
        format: 'nat',
        default: 20,
        env: 'FILES_S3_MAXIMUM_TERM_THRESHOLD'
      },
      retentionBaseYears: {
        doc: 'Base number of years added to agreement end date for retention calculation',
        format: 'nat',
        default: 7,
        env: 'FILES_S3_RETENTION_BASE_YEARS'
      },
      endpoint: {
        doc: 'Optional custom S3 endpoint (LocalStack or custom gateway); leave empty in CDP',
        format: String,
        nullable: true,
        default: null,
        env: 'AWS_S3_ENDPOINT'
      }
    }
  },
  viewAgreementURI: {
    doc: 'PDF URI to be used to print the agreement',
    format: String,
    default: 'http://localhost:3555',
    env: 'VIEW_AGREEMENT_URI'
  },
  featureFlags: {
    seedDb: {
      doc: 'Seed the database',
      format: STRICT_BOOLEAN_FORMAT,
      default: false,
      env: 'SEED_DB'
    },
    testEndpoints: {
      doc: 'Enable test endpoints',
      format: STRICT_BOOLEAN_FORMAT,
      default: false,
      env: 'ENABLE_TEST_ENDPOINTS'
    },
    isJwtEnabled: {
      doc: 'Enable JWT authentication validation',
      format: STRICT_BOOLEAN_FORMAT,
      default: true,
      env: 'JWT_ENABLED'
    },
    isPaymentHubEnabled: {
      doc: 'Enable or Disable payments hub',
      format: STRICT_BOOLEAN_FORMAT,
      default: false,
      env: 'ENABLE_PAYMENT_HUB'
    }
  }
})

config.validate({ allowed: 'strict' })

export { config }

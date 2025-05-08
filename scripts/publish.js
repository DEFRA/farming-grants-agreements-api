/* eslint-disable @typescript-eslint/no-var-requires, no-undef, no-console */
const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns')

const sns = new SNSClient({
  region: 'eu-west-2',
  endpoint: 'http://localhost:4566',
  credentials: { accessKeyId: 'test', secretAccessKey: 'test' }
})

async function publishTestEvent() {
  const topicArn =
    'arn:aws:sns:eu-west-2:000000000000:grant_application_approved'

  const message = {
    eventType: 'grant_application_approved',
    applicationId: 'APP-123456',
    sbi: '123456789',
    grantAmount: 30000
  }

  await sns.send(
    new PublishCommand({
      TopicArn: topicArn,
      Message: JSON.stringify(message)
    })
  )

  console.log('🚀 Published test grant_application_approved event!')
}

publishTestEvent().catch(console.error)

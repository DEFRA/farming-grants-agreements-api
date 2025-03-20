import mongoose from 'mongoose'
import { Agreement } from '../models/agreement.model.js'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config()

const seedAgreements = [
  {
    agreementId: 'SFI987654321',
    title: 'SFI Agreement 2024',
    content: 'This is a sample SFI agreement',
    status: 'draft',
    payments: [
      {
        description: 'Payment 1',
        amount: 1000.00,
        date: '2024-04-01'
      }
    ]
  },
  {
    agreementId: 'SFI123456789',
    title: 'SFI Agreement 2023',
    content: 'This is another sample SFI agreement',
    status: 'draft',
    payments: [
      {
        description: 'Payment 1',
        amount: 2000.00,
        date: '2023-04-01'
      }
    ]
  }
]

const seedDatabase = async () => {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017'
    const mongoDb = process.env.MONGO_DATABASE || 'farming-grants-agreements-api'
    
    console.log(`Connecting to MongoDB at ${mongoUri}/${mongoDb}`)
    await mongoose.connect(`${mongoUri}/${mongoDb}`)
    console.log('Connected to MongoDB')

    // Drop existing agreements collection
    await mongoose.connection.collection('agreements').drop()
    console.log('Dropped existing agreements collection')

    // Insert seed data
    await Agreement.insertMany(seedAgreements)
    console.log('Inserted seed agreements:', seedAgreements.length)

    // Close connection
    await mongoose.connection.close()
    console.log('Database connection closed')
  } catch (error) {
    console.error('Error seeding database:', error)
    process.exit(1)
  }
}

seedDatabase() 
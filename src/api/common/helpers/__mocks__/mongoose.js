// Mock mongoose for testing
const mockConnection = {
  readyState: 1, // Connected state
  close: jest.fn(),
  on: jest.fn()
}

const mockSchema = jest.fn().mockImplementation(() => ({
  add: jest.fn(),
  pre: jest.fn(),
  post: jest.fn(),
  methods: {},
  statics: {},
  virtuals: {},
  indexes: [],
  index: jest.fn()
}))

// Add Types property to Schema
mockSchema.Types = {
  ObjectId: jest.fn()
}

// Make Schema a proper constructor
Object.setPrototypeOf(mockSchema, Function.prototype)

const mockModel = jest.fn().mockImplementation((_collection, schema) => {
  // Create a base mock with standard mongoose methods
  const mock = {
    find: jest.fn(),
    findOne: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    updateOne: jest.fn(),
    updateMany: jest.fn(),
    deleteOne: jest.fn(),
    deleteMany: jest.fn(),
    countDocuments: jest.fn(),
    aggregate: jest.fn(),
    distinct: jest.fn(),
    findOneAndUpdate: jest.fn()
  }

  // Preserve static methods from the schema if they exist
  if (schema?.statics) {
    Object.assign(mock, schema.statics)
  }

  return mock
})

const mongoose = {
  connect: jest.fn().mockResolvedValue(mockConnection),
  disconnect: jest.fn().mockResolvedValue(),
  connection: mockConnection,
  Schema: mockSchema,
  model: mockModel,
  Types: {
    ObjectId: jest.fn()
  },
  STATES: {
    connected: 1,
    connecting: 2,
    disconnecting: 3,
    disconnected: 0
  }
}

export default mongoose

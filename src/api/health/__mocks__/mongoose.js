const mockPing = jest.fn()
const mockModel = jest.fn().mockImplementation((_collection, schema) => {
  // Create a base mock with standard mongoose methods
  const mock = {
    find: jest.fn().mockReturnThis(),
    findOne: jest.fn().mockReturnThis(),
    findById: jest.fn().mockReturnThis(),
    create: jest.fn().mockReturnThis(),
    updateOne: jest.fn().mockReturnThis(),
    updateMany: jest.fn().mockReturnThis(),
    deleteOne: jest.fn().mockReturnThis(),
    deleteMany: jest.fn().mockReturnThis(),
    countDocuments: jest.fn().mockReturnThis(),
    aggregate: jest.fn().mockReturnThis(),
    distinct: jest.fn().mockReturnThis(),
    findOneAndUpdate: jest.fn().mockReturnThis(),
    lean: jest.fn().mockReturnThis()
  }

  // Preserve static methods from the schema if they exist
  if (schema?.statics) {
    Object.assign(mock, schema.statics)
  }

  return mock
})

// Minimal Schema constructor so code using `new mongoose.Schema(...)` works
class MockSchema {
  constructor(definition, options) {
    this.definition = definition
    this.options = options || {}
    this._indexes = []
    this._plugins = []

    // Ensure statics/methods exist so code can assign to them
    this.statics = {}
    this.methods = {}
    // simple hook storage to avoid errors if code registers hooks
    this._hooks = { pre: [], post: [] }
  }

  // support schema.index(...)
  index(fields, opts) {
    this._indexes.push({ fields, opts })
    return this
  }

  // minimal set to allow schema.set(...)
  set(key, value) {
    this.options[key] = value
    return this
  }

  // minimal plugin support
  plugin(fn, opts) {
    this._plugins.push({ fn, opts })
    return this
  }

  // minimal virtual API (chainable)
  virtual() {
    return {
      get: jest.fn(),
      set: jest.fn(),
      applyGetters: jest.fn()
    }
  }

  // support registering middleware hooks
  pre(hookName, fn) {
    this._hooks.pre.push({ hookName, fn })
    return this
  }

  post(hookName, fn) {
    this._hooks.post.push({ hookName, fn })
    return this
  }
}

// Provide Schema.Types so code that accesses mongoose.Schema.Types.ObjectId works
MockSchema.Types = {
  ObjectId: jest.fn(),
  Mixed: class MockMixed {}
}

const mockConnection = {
  db: {
    admin: () => ({ ping: mockPing })
  },
  readyState: 1, // Connected state
  on: jest.fn(),
  once: jest.fn(),
  close: jest.fn()
}

const mongooseDefault = {
  connect: jest.fn().mockResolvedValue(mockConnection),
  disconnect: jest.fn(),
  connection: mockConnection,
  Schema: MockSchema,
  model: mockModel,
  Types: { ObjectId: jest.fn() },
  set: jest.fn()
}

// default export is the mock mongoose API
export default mongooseDefault

// named exports so tests can control behavior via dynamic import('mongoose')
export { mockPing as __mockPing, mockModel as __mockModel }

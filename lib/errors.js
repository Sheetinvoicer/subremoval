export class ValidationError extends Error {
  constructor(message) {
    super(message)
    this.name = 'ValidationError'
  }
}

export const asyncHandler = (fn) => async (req, res, next) => {
  try {
    return await fn(req, res, next)
  } catch (error) {
    console.error('Async handler error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: error instanceof ValidationError ? 400 : 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

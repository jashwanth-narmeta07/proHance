import ApiError from '../utils/ApiError.js';

/**
 * validate({ body, params, query }) - each key is an optional Zod schema.
 * On success, replaces req.body/params/query with the parsed (and coerced/
 * defaulted) result so downstream code can trust the shape.
 */
export function validate(schemas) {
  return function validationMiddleware(req, res, next) {
    for (const key of ['params', 'query', 'body']) {
      const schema = schemas[key];
      if (!schema) continue;
      const result = schema.safeParse(req[key]);
      if (!result.success) {
        const details = result.error.issues.map((i) => ({
          field: i.path.join('.'),
          message: i.message,
        }));
        throw ApiError.badRequest('Validation failed', 'VALIDATION_ERROR', details);
      }
      req[key] = result.data;
    }
    next();
  };
}

export function sendSuccess(res, { statusCode = 200, data = {}, message = 'Success' } = {}) {
  return res.status(statusCode).json({ success: true, data, message });
}

export function sendError(res, { statusCode = 500, message = 'Something went wrong', code = 'INTERNAL_ERROR', details } = {}) {
  const body = { success: false, message, code };
  if (details) body.details = details;
  return res.status(statusCode).json(body);
}

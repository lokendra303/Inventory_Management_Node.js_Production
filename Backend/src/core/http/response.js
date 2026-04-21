function ok(res, data = null, message = null, status = 200) {
  return res.status(status).json({
    success: true,
    ...(message ? { message } : {}),
    ...(data !== null ? { data } : {}),
  });
}

function fail(res, status = 500, error = 'Internal server error', details = null) {
  return res.status(status).json({
    success: false,
    error,
    ...(details ? { details } : {}),
  });
}

module.exports = { ok, fail };

/**
 * Middleware de validation Zod
 * Usage: router.post('/route', validate(schema), handler)
 */

export function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Données invalides',
          details: result.error.flatten()
        }
      });
    }
    req.validated = result.data;
    next();
  };
}

export function validateQuery(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Paramètres invalides',
          details: result.error.flatten()
        }
      });
    }
    req.validatedQuery = result.data;
    next();
  };
}

export default validate;

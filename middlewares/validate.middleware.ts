import type { Request, Response, NextFunction } from "express";
import type { ZodType } from "zod";

export const validate =
  (schema: ZodType) => (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse({
      body: req.body,
      query: req.query,
      params: req.params,
    });

    if (!result.success) {
      const errors = result.error.issues.map((issue) => ({
        location: issue.path[0] as string,
        field: issue.path.slice(1).join(".") || (issue.path[0] as string),
        message: issue.message,
      }));

      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors,
      });
    }

    const parsed = result.data as {
      body?: unknown;
      query?: unknown;
      params?: unknown;
    };
    if (parsed.body !== undefined) req.body = parsed.body;
    if (parsed.query !== undefined)
      req.query = parsed.query as Request["query"];
    if (parsed.params !== undefined)
      req.params = parsed.params as Request["params"];

    next();
  };

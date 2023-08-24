import { AnyZodObject } from 'zod';
import { Request, Response, NextFunction } from 'express';

const validate =
  (schema: AnyZodObject) =>
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
        headers: req.headers
      });

      return next();
    } catch (error) {
      return res.status(400).json(error);
    }
  };

export default validate;

import { ErrorRequestHandler, Request, Response, NextFunction } from 'express';

type DefaultErrorType = {
  message: string;
  statusCode: number;
  errors: Array<any>;
  name?: string;
};

// @ts-ignore
const errorMiddleware: ErrorRequestHandler = async (
  err: DefaultErrorType,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  let message = err?.message || JSON.stringify(err?.message);
  const statusCode = err?.statusCode || 400;

  res.status(statusCode).send({
    statusCode,
    message:
      message ?? 'Something went wrong. Check your request and try again.'
  });
};

export default errorMiddleware;

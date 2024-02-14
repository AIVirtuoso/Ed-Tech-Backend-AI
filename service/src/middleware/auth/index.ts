import { Request, Response, NextFunction } from 'express';
import config from '../../../config/development';

const API_KEY = config.localAuth;
const X_SHEPHERD_HEADER = 'x-shepherd-header';

const authValidate = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const requestApiKey = req.headers[X_SHEPHERD_HEADER];
  try {
    if (requestApiKey === API_KEY) next();
    else throw new Error('Invalid API key');
  } catch (e) {
    next(e);
  }
};

export default authValidate;

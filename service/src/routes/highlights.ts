import express from 'express';
import { Request, Response, NextFunction } from 'express';
import validate from '../validation/index';
import Schema from '../validation/schema';
import {
  createOrUpdateHighlight,
  getHighlights
} from '../../db/models/highlights';

const { highlights } = Schema;
const highlight = express.Router();

interface Query {
  documentId: string;
}

highlight.post(
  '/',
  validate(highlights),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      let { documentId, highlight } = req.body;

      const data = await createOrUpdateHighlight({ documentId, highlight });

      res.send({ status: 'Highlight successfully created!', data });
    } catch (e: any) {
      next({
        message:
          "Check that your documentId matches an actual document, and that you're correctly supplying the highlight payload"
      });
    }
  }
);

highlight.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    let { documentId } = req.query as unknown as Query;

    if (!documentId)
      throw new Error('You need a documentId to retrieve document highlights!');

    const data = await getHighlights(documentId);

    res.send(data);
  } catch (e: any) {
    next(e);
  }
});

export default highlight;

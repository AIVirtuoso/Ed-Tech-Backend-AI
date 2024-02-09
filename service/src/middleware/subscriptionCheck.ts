import { database } from 'firebase-admin';
import { Request, Response, NextFunction } from 'express';
import * as Sentry from '@sentry/node';
import { OPENAI_MODELS } from '../helpers/constants';
import 'express';

declare module 'express' {
  export interface Request {
    subscriptionTier?: string;
    gptVersion?: string;
  }
}

const checkUserSubscription = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const firebaseId = req.body.firebaseId || '';
    if (!firebaseId) {
      return res.status(400).send('Firebase ID must be provided');
    }
    const db = database();
    const subscriptionRef = db.ref(
      `user-subscriptions/${firebaseId}/subscription`
    );

    const snapshot = await subscriptionRef.once('value');
    const subscription = snapshot.val();

    if (subscription && subscription.tier) {
      req.subscriptionTier = subscription.tier;
      // Set the GPT version based on the subscription tier
      req.gptVersion =
        req.subscriptionTier === 'Premium'
          ? OPENAI_MODELS.GPT_4
          : OPENAI_MODELS.GPT_3_5_16K;
      next();
    } else {
      console.log('Subscription information not found');
      req.gptVersion = OPENAI_MODELS.GPT_3_5_16K;
      next();
    }
  } catch (error) {
    // Sentry.captureException(error);
    // res.status(500).send('Error fetching subscription data');
    console.log('Error fetching subscription data');
    req.gptVersion = OPENAI_MODELS.GPT_3_5_16K;
    next();
  }
};

export default checkUserSubscription;

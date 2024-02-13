import { database } from 'firebase-admin';

/**
 * Get the available balance of various types for the account
 * @param accountId The Fermata account ID of the customer
 * @param companyId Your Company ID for Fermata (c_********)
 * @param apiKey Your Fermata API Key
 * @returns string ID of event. You don't need to keep this if you don't want to
 * @throws Error if something went wrong. Could be that they didn't have enough balance to do the event
 */
export async function getAccountBalance(
  accountId: string,
  denomination: string,
  companyId: string,
  apiKey: string
) {
  const url = `https://api.gofermata.com/v1/accounts/${accountId}/balance/${denomination}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${btoa(`${companyId}:${apiKey}`)}`
    }
  });

  if (response.ok) {
    const body = await response.json();
    console.log(body);
    return body.data;
  } else {
    const textBody = await response.text();
    console.log('Error from Fermata:', textBody);
    throw new Error('Failed to get account balance');
  }
}

/**
 * This function pushes an event for billing to the Fermata API.
 * @param accountId The Fermata account ID of the customer
 * @param eventType Event type (something like "flashcard" is good here)
 * @param eventCost Amount to deduct from balance for this event
 * @param eventDenomination Which balance account to deduct from. ("flashcards", "quizzes", etc)
 * @param companyId The Shepherd Company ID for Fermata (c_mf3xfk7x)
 * @param apiKey Shepherd's Fermata API Key
 * @returns string ID of event. You don't need to keep this if you don't want to
 * @throws Error If there are not sufficient funds to push the event
 */
export async function pushEvent(
  accountId: string,
  eventType: string,
  eventCost: number,
  eventDenomination: string,
  companyId: string,
  apiKey: string
): Promise<any> {
  const url = `https://api.gofermata.com/v1/accounts/${accountId}/events`;
  const payload = {
    type: eventType,
    cost_override_amount: eventCost,
    cost_override_denomination: eventDenomination,
    gate_on_balance: true // Push will fail if not enough balance
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${btoa(`${companyId}:${apiKey}`)}`
    },
    body: JSON.stringify(payload)
  });

  if (response.ok) {
    const body = await response.json();
    return body.data;
  } else {
    const textBody = await response.text();
    console.log('Error from Fermata:', textBody);
    throw new Error('Failed to push event');
  }
}

export const getDocchatBalance = async (
  firebaseId: string,
) => {
  const db = database();
  const fermataCustomerRef = db.ref(
    `user-subscriptions/${firebaseId}/fermataCustomerId`
  );

  try {
    const snapshot = await fermataCustomerRef.once('value');
    const fermataCustomerId = snapshot.val();
    // let balance;
    if (fermataCustomerId) {
      try {
        const chatLimit = await getAccountBalance(
          fermataCustomerId,
          'docchats',
          process.env.FERMATA_COMPANY_ID as string,
          process.env.FERMATA_API_KEY as string
        );
        console.log('chatLimit object', chatLimit);
        return chatLimit.amount;
      } catch (error) {
        console.log('FERMATA docchats ERROR!!!', error);
        return 0;
      }
    } else {
      throw new Error('fermataCustomerId is null');
    }
  } catch (error) {
    console.error('Error fetching fermataCustomerId: ', error);
  }
};

export const setDocchatBalance = async (firebaseId: string) => {
  const db = database();
  const fermataCustomerRef = db.ref(
    `user-subscriptions/${firebaseId}/fermataCustomerId`
  );

  try {
    const snapshot = await fermataCustomerRef.once('value');
    const fermataCustomerId = snapshot.val();
    if (fermataCustomerId) {
      try {
        const chatLimit = await pushEvent(
          fermataCustomerId,
          'CHAT',
          1,
          'docchats',
          process.env.FERMATA_COMPANY_ID as string,
          process.env.FERMATA_API_KEY as string
        );
        return chatLimit.balance.amount
      } catch (error) {
        console.log(error);
        return 0;
      }
    } else {
      throw new Error('fermataCustomerId is null');
    }
  } catch (error) {
    console.error('Error fetching fermataCustomerId: ', error);
  }
};

export const getAItutorChatBalance = async (firebaseId: string) => {
  const db = database();
  const fermataCustomerRef = db.ref(
    `user-subscriptions/${firebaseId}/fermataCustomerId`
  );

  try {
    const snapshot = await fermataCustomerRef.once('value');
    const fermataCustomerId = snapshot.val();
    if (fermataCustomerId) {
      try {
        const chatLimit = await getAccountBalance(
          fermataCustomerId,
          'aitutorchats',
          process.env.FERMATA_COMPANY_ID as string,
          process.env.FERMATA_API_KEY as string
        );
        console.log('chatLimit object', chatLimit);
        return chatLimit.amount;
      } catch (error) {
        console.log('FERMATA aitutorchats ERROR!!!', error);
        return 0;
      }
    } else {
      throw new Error('fermataCustomerId is null');
    }
  } catch (error) {
    console.error('Error fetching fermataCustomerId: ', error);
  }
};

export const setAItutorChatBalance = async (firebaseId: string) => {
  const db = database();
  const fermataCustomerRef = db.ref(
    `user-subscriptions/${firebaseId}/fermataCustomerId`
  );

  try {
    const snapshot = await fermataCustomerRef.once('value');
    const fermataCustomerId = snapshot.val();
    if (fermataCustomerId) {
      try {
        const chatLimit = await pushEvent(
          fermataCustomerId,
          'CHAT',
          1,
          'aitutorchats',
          process.env.FERMATA_COMPANY_ID as string,
          process.env.FERMATA_API_KEY as string
        );
        return chatLimit.balance.amount;
      } catch (error) {
        console.log(error);
        return 0;
      }
    } else {
      throw new Error('fermataCustomerId is null');
    }
  } catch (error) {
    console.error('Error fetching fermataCustomerId: ', error);
  }
};
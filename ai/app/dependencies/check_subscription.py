import os
from fastapi import FastAPI, Request
from starlette.middleware.base import BaseHTTPMiddleware
from fastapi.responses import JSONResponse
from firebase_admin import db

app = FastAPI()

class ShepherdSubscriptionMiddleware(BaseHTTPMiddleware):
    OPENAI_MODELS = {
    "GPT_3_5_16K": "gpt-3.5-turbo-16k-0613",
    "GPT_4": "gpt-4-1106-preview"
}
    async def dispatch(self, request: Request, call_next):
        firebase_id = request.body["firebase_id"]  
        if not firebase_id: 
                return JSONResponse(status_code=400, content={"message": "firebase_id missing"})
        try:
            db = db()
            subscription_ref = db.ref(f"user-subscriptions/{firebase_id}/subscription")
            snapshot = await subscription_ref.get()
            subscription = snapshot.val()

            if subscription and subscription.get("tier"):
                request.subscription_tier = subscription["tier"]
                request.gpt_version = (
                    self.OPENAI_MODELS["GPT_4"] if request.subscription_tier == "Premium" else self.OPENAI_MODELS.GPT_3_5_16K
                )
            else:
                request.gpt_version = self.OPENAI_MODELS["GPT_3_5_16K"]

        except Exception as e:
            print(f"Error fetching subscription data: {e}")
            request.gpt_version = self.OPENAI_MODELS["GPT_3_5_16K"]
        response = await call_next(request)
        return response



  

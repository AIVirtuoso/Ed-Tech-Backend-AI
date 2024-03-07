import os
from fastapi import FastAPI, Request
from starlette.middleware.base import BaseHTTPMiddleware
from fastapi.responses import JSONResponse

app = FastAPI()

class ShepherdHeaderMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        x_shepherd = request.headers.get('X-Shepherd-Header')
        print(x_shepherd)
        print(os.environ.get("SHEP_API_KEY"))
        if x_shepherd is None or x_shepherd != os.environ.get("SHEP_API_KEY"):
            return JSONResponse(
                status_code=401,
                content={"message": "Invalid X-Shepherd-Header provided"},
            )

        response = await call_next(request)
        return response


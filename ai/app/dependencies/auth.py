from fastapi import Header, HTTPException
from typing_extensions import Annotated
import os

async def check_shepherd_header(x_shepherd: Annotated[str, Header()]):
    if x_shepherd is None or x_shepherd != os.getenv("shep_api_key"):
        raise HTTPException(
            status_code=401,
            detail="Invalid X-Shepherd-Header provided",
        )
from typing import Literal

def wrap_for_ql(role: Literal['user', 'assistant'], content: str) -> dict:
    return {
        'role': role,
        'content': content
    }

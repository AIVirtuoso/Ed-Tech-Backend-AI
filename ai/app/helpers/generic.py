from typing import List, Optional, Dict, Union, Literal
def wrap_for_ql(role: Literal['user', 'assistant'], content: str, solve: Optional[bool] = None) -> dict:
    if solve is not None:
        solve_str = str(solve)
        return {
            'role': role,
            'content': content,
            'is_solved': solve_str
        }
    else:
        return {
            'role': role,
            'content': content
        }

def find_tc_in_messages(list_of_dicts: List[Dict[str, Union[Optional[str], str]]]):
    for d in reversed(list_of_dicts):
        if d["role"] == "function":
            return d
    return None

def build_chat_history(tutor: str, student: str, history: List = []):
    chat = f"Student: {student}\nTutor: {tutor}"
    history.append(chat)
    return history


def convert_to_conversation(messages: list[Dict[str, str | None]]):
    conversation = ""
    for message in messages:
        role = message['role']
        content = message['content']
        if role == 'user':
            conversation += f"user: {content}\n"
        elif role == 'assistant':
            conversation += f"assistant: {content}\n"
        # Handles cases where the dictionary might have other roles or specific handling is needed
        else:
            conversation += f"{role}: {content}\n"
    return conversation.strip()
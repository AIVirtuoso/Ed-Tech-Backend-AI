import os
import requests
import base64
from firebase_admin import db


def get_account_balance(account_id: str, denomination: str, company_id: str, api_key: str) -> int:
    url = f"https://api.gofermata.com/v1/accounts/{account_id}/balance/{denomination}"
    headers = {
        'Content-Type': 'application/json',
        'Authorization': f'Basic {base64.b64encode(f"{company_id}:{api_key}".encode()).decode()}'
    }
    response = requests.get(url, headers=headers)
    response.raise_for_status()
    return response.json().get('data', {}).get('amount', 0)

def push_event(account_id: str, event_type: str, event_cost: int, event_denomination: str, company_id: str, api_key: str) -> dict:
    url = f"https://api.gofermata.com/v1/accounts/{account_id}/events"
    payload = {
        'type': event_type,
        'cost_override_amount': event_cost,
        'cost_override_denomination': event_denomination,
        'gate_on_balance': True
    }
    headers = {
        'Content-Type': 'application/json',
        'Authorization': f'Basic {base64.b64encode(f"{company_id}:{api_key}".encode()).decode()}'
    }
    response = requests.post(url, json=payload, headers=headers)
    response.raise_for_status()
    return response.json().get('data')

def get_docchat_balance(firebase_id: str) -> bool:
    ref = db.reference(f'user-subscriptions/{firebase_id}/fermataCustomerId')
    fermata_customer_id = ref.get()
    if fermata_customer_id:
        try:
            chat_limit = get_account_balance(fermata_customer_id, 'docchats', os.getenv('FERMATA_COMPANY_ID'), os.getenv('FERMATA_API_KEY'))
            return not chat_limit or chat_limit < 1
        except Exception as e:
            print(f'Error getting docchat balance: {e}')
            return True
    else:
        raise ValueError('fermataCustomerId is null')

def set_docchat_balance(firebase_id: str) -> int:
    ref = db.reference(f'user-subscriptions/{firebase_id}/fermataCustomerId')
    fermata_customer_id = ref.get()
    if fermata_customer_id:
        try:
            chat_limit = push_event(fermata_customer_id, 'CHAT', 1, 'docchats', os.getenv('FERMATA_COMPANY_ID'), os.getenv('FERMATA_API_KEY'))
            return chat_limit.get('balance', {}).get('amount', 0)
        except Exception as e:
            print(f'Error setting docchat balance: {e}')
            return 0
    else:
        raise ValueError('fermataCustomerId is null')

def get_aitutor_chat_balance(firebase_id: str) -> bool:
    ref = db.reference(f'user-subscriptions/{firebase_id}/fermataCustomerId')
    fermata_customer_id = ref.get()
    if fermata_customer_id:
        try:
            chat_limit = get_account_balance(fermata_customer_id, 'aitutorchats', os.getenv('FERMATA_COMPANY_ID'), os.getenv('FERMATA_API_KEY'))
            return not chat_limit or chat_limit < 1
        except Exception as e:
            print(f'Error getting aitutor chat balance: {e}')
            return True
    else:
        raise ValueError('fermataCustomerId is null')

def set_aitutor_chat_balance(firebase_id: str) -> int:
    ref = db.reference(f'user-subscriptions/{firebase_id}/fermataCustomerId')
    fermata_customer_id = ref.get()
    if fermata_customer_id:
        try:
            chat_limit = push_event(fermata_customer_id, 'CHAT', 1, 'aitutorchats', os.getenv('FERMATA_COMPANY_ID'), os.getenv('FERMATA_API_KEY'))
            return chat_limit.get('balance', {}).get('amount', 0)
        except Exception as e:
            print(f'Error setting aitutor chat balance: {e}')
            return 0
    else:
        raise ValueError('fermataCustomerId is null')

# maybe order_by_key().get()
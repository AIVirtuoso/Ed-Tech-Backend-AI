import axios from 'axios';
import { MAIN_SERVICE_ENDPONT } from '../constants';
async function fetchNote(id) {
    const API_ENDPOINT = `${MAIN_SERVICE_ENDPONT}/notes/${id}`; // replace with your actual endpoint
    const response = await axios.get(API_ENDPOINT, {
        headers: {
            'x-api-key': 'AIzaSyZhxyXWtHTbgdZju8zjHPX7Gp6lIuXP23aLN5uPZ'
        }
    });
    return response.data?.data?.data;
}
export default fetchNote;

import axios from 'axios';
import { MAIN_SERVICE_ENDPONT } from '../constants';

async function fetchNote(id: string, isDevelopment = false) {
  const baseUrl = !isDevelopment
    ? MAIN_SERVICE_ENDPONT
    : 'https://develop--api-sheperdtutors.netlify.app';

  const API_ENDPOINT = `${baseUrl}/notes/${id}`; // replace with your actual endpoint

  const response = await axios.get(API_ENDPOINT, {
    headers: {
      'x-api-key': 'AIzaSyZhxyXWtHTbgdZju8zjHPX7Gp6lIuXP23aLN5uPZ'
    }
  });

  return response.data?.data?.data;
}

export async function fetchNotes(studentId: string, isDevelopment = false) {
  const baseUrl = !isDevelopment
    ? MAIN_SERVICE_ENDPONT
    : 'https://develop--api-sheperdtutors.netlify.app';

  const API_ENDPOINT = `${baseUrl}/notes?studentId=${studentId}`; // replace with your actual endpoint

  const response = await axios.get(API_ENDPOINT, {
    headers: {
      'x-api-key': 'AIzaSyZhxyXWtHTbgdZju8zjHPX7Gp6lIuXP23aLN5uPZ'
    }
  });
  console.log(response);
  return response.data?.data?.data;
}

export default fetchNote;

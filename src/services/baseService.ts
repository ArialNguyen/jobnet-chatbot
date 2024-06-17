import ErrorType from '@/types/error';
interface requestOptions {
  method: "POST" | "PUT" | "PATCH" | "DELETE" | "GET",
  body?: any,
  headers?: any
}
class BaseService {

  protected checkResponseNotOk(res: Response) {
    if (res.status < 200 || res.status >= 300) {
      if (res.status == 401) {
        /**
         * Doing something to handle if use stay too long (over expired time) in one page 
         * and click the fetch api needed a accessToken expired 
         * maybe signout and refresh the page and show Toast to nofify user login.
         */
      }
      return res.json().then((response) => {
        throw response as ErrorType;
      });
    }
  }

  protected getResponseData<T>(res: Response) {
    return res.json() as T;
  }

  protected getResponseBlob(res: Response) {
    return res.blob();
  }
}

export default BaseService;

import BaseService from "@/services/baseService";

export class FbService extends BaseService {
  private readonly apiBaseUrl = 'https://graph.facebook.com/v20.0';

  async getConversationId(pageId: string, senderPsid: string) {
    const params = new URLSearchParams()
    params.append("user_id", senderPsid)
    params.append("access_token", process.env.PAGE_ACCESS_TOKEN_FB as string)


    const url = `${this.apiBaseUrl}/${pageId}/conversations?${params.toString()}`
    const res = await fetch(url)

    this.checkResponseNotOk(res);

    const resData = await this.getResponseData<any>(res)
    return resData.data[0].id as string;
  }

  async getHistoryMessages(conversationId: string) {

    const params = new URLSearchParams()
    params.append("fields", 'id,message,from')
    params.append("access_token", process.env.PAGE_ACCESS_TOKEN_FB as string)

    const url = `${this.apiBaseUrl}/${conversationId}/messages?${params.toString()}`

    const res = await fetch(url)

    this.checkResponseNotOk(res);

    const resData = await this.getResponseData<any>(res);

    return resData.data as Array<any>;
  }

  async callSendAPI(senderPsid: string, pageId: string, response: object) {

    const params = new URLSearchParams()
    params.append("access_token", process.env.PAGE_ACCESS_TOKEN_FB as string)

    const url = `${this.apiBaseUrl}/${pageId}/messages?${params.toString()}`

    const requestBody = {
      "recipient": {
        "id": senderPsid,
      },
      "message": response,
    }    

    const res = await fetch(url, {
      method: "POST",
      body: JSON.stringify(requestBody) ,
      headers: {
        'Content-Type': 'application/json',
      }
    })
    await this.checkResponseNotOk(res)

    console.log("Message sent!");
  }
}
const fbService = new FbService();
export default fbService

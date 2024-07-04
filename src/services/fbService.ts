import BaseService from "@/services/baseService";
import { SenderInfomation } from "@/types/senderInformation";

class FbService extends BaseService {
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

  async sendMessage(senderPsid: string, pageId: string, response: object) {

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
      body: JSON.stringify(requestBody),
      headers: {
        'Content-Type': 'application/json',
      }
    })
    await this.checkResponseNotOk(res)

    console.log("Message sent!");
  }

  async getFacebookUsername(senderPsid: string) {
    const params = new URLSearchParams()
    params.append("access_token", process.env.PAGE_ACCESS_TOKEN_FB as string)
    params.append("fields", "first_name,last_name")

    const url = `${this.apiBaseUrl}/${senderPsid}?${params.toString()}`
    const res = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
      }
    })

    await this.checkResponseNotOk(res)
    return this.getResponseData<SenderInfomation>(res)
  }

  async sendOnTyping(pageId: string, senderPsid: string) {
    const params = new URLSearchParams()
    params.append("access_token", process.env.PAGE_ACCESS_TOKEN_FB as string)

    let reqBody = {
      "recipient": {
        "id": senderPsid
      },
      "sender_action": "typing_on"
    };

    const url = `${this.apiBaseUrl}/${pageId}/messages?${params.toString()}`
    const res = await fetch(url, {
      method: "POST",
      body: JSON.stringify(reqBody),
      headers: {
        'Content-Type': 'application/json',
      }
    })

    await this.checkResponseNotOk(res)
  }
}
const fbService = new FbService();
export default fbService

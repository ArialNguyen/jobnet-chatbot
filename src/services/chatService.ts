import BaseService from "@/services/baseService";
import { Message } from "@/types/webhook/facebook/messageEventBody";

class ChatService extends BaseService{

    async getMessage(messages: Array<any>) {

        const res = await fetch('http://127.0.0.1:8000/api/chat/', {
            method: "POST",
            body: {messages} as any,
            headers: {
                'Content-Type': 'application/json'
            }
        })

        this.checkResponseNotOk(res)
        return this.getResponseData(res) as Message
    }
}

const chatService = new ChatService();
export default chatService


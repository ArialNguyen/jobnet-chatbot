import BaseService from "@/services/baseService";

class HuspotConversationService extends BaseService {
  private readonly apiBaseUrl = `${process.env.NEXT_PUBLIC_HUSPOT_API_URL}/conversations/v3/conversations`

  async getQuestion(threadId: string, messageId: string) {

    const url = `${this.apiBaseUrl}/threads/${threadId}/messages/${messageId}`
    const res = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.HUSPOT_TOKEN}`,
      }
    })

    this.checkResponseNotOk(res)

    const resData = await this.getResponseData<any>(res)
    return resData.text as string
  }

  async getSingleThread(threadId: string) {

    const url = `${this.apiBaseUrl}/threads/${threadId}`
    const res = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.HUSPOT_TOKEN}`,
      }
    })

    await this.checkResponseNotOk(res);

    return await this.getResponseData<any>(res)
  }

  async getMessagesFromConversation(threadId: string) {

    const url = `${this.apiBaseUrl}/threads/${threadId}/messages`
    const res = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.HUSPOT_TOKEN}`,
      }
    })

    await this.checkResponseNotOk(res);

    const resData = await this.getResponseData<any>(res)

    return resData.results
      .filter((message: any) => message.type == "MESSAGE" && message.text != undefined)
      .map((message: any) => {
        return {
          id: message.id,
          createdBy: message.createdBy,
          text: message.text
        }
      });
  }

  async sendMessageFromAIByDefault(props: {
    threadId: string,
    text: string,
    richText: string,
    sender?: "AI" | "ASSISTANT",
    type?: string
  }
  ) {
    props.type = props.type || "MESSAGE"
    const senderActorId = ( props.sender === undefined || props.sender === "AI" ) ? process.env.HUBSPOT_AI_ACTOR_ID : process.env.HUBSPOT_ASSISTANT_ACTOR_ID
    const { originalChannelId: channelId, originalChannelAccountId: channelAccountId } = await this.getSingleThread(props.threadId)

    const url = `${this.apiBaseUrl}/threads/${props.threadId}/messages`
    await fetch(url, {
      method: "POST",
      body: JSON.stringify({
        type: props.type, text: props.text,
        richText: props.richText, senderActorId,
        channelId: channelId, channelAccountId: channelAccountId
      }),
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.HUSPOT_TOKEN}`,
      }
    })
    console.log("Message sent!");
  }

}
const huspotConversationService = new HuspotConversationService()
export default huspotConversationService

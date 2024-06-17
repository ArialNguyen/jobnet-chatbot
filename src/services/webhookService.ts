import chatService from "@/services/chatService";
import fbService from "@/services/fbService";
import HubQueryDto from "@/types/webhook/facebook/hubAuthenticagte";
import MessageEventBody, { Entry, MessagingMessage } from "@/types/webhook/facebook/messageEventBody";

class WebhookService {

  validateVerificationRequest(query: HubQueryDto) {
    const mode = query['hub.mode'];
    const token = query['hub.verify_token'];
    const challenge = query['hub.challenge'];

    if (
      mode !== 'subscribe' ||
      token !== process.env.VERIFY_TOKEN
    ) {
      throw new Error();
    }
    return challenge;
  }

  async receiveWebhookNotification(body: MessageEventBody) {
    try {
      const handleEntry = async (entry: Entry) => {
        
        const webhookEvent = entry.messaging[0];
        const senderPsid = webhookEvent.sender.id;
        const pageId = webhookEvent.recipient.id;
        
        if (webhookEvent.message) {
          await this.handleMessage(senderPsid, pageId, webhookEvent.message);
        }
      }
  
      // Iterates over each entry - there may be multiple if batched
      
      body.entry.forEach(await handleEntry);
    } catch (error) {
      
    }
    return 'EVENT_RECEIVED';
  }

  private async handleMessage(
    senderPsid: string,
    pageId: string,
    receivedMessage: MessagingMessage,
  ) {
    
    const conversationId = await fbService.getConversationId(
      pageId,
      senderPsid,
    );
    const historyMessages = (
      await fbService.getHistoryMessages(conversationId)
    )
      .map((item) => ({
        role: item.from.id === senderPsid ? 'user' : 'assistant',
        content: item.message,
      }))
      .reverse();

    let response = {};
    if (receivedMessage.text) {
      historyMessages.push({
        role: 'user',
        content: receivedMessage.text,
      });
      
      // const message = await chatService.getMessage(historyMessages);
      // response = { text: message.content };
    }
    response = {text: "Hi There"} // Need to Remove
    
    await fbService.callSendAPI(senderPsid, pageId, response);
  }
}

const webhookService = new WebhookService();
export default webhookService

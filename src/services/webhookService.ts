import chatService from "@/services/chatService";
import fbService from "@/services/fbService";
import HubQueryDto from "@/types/webhook/facebook/hubAuthenticagte";
import MessageEventBody, { Entry, MessagingMessage, PostBack } from "@/types/webhook/facebook/messageEventBody";

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
        console.log("Sender ID: ", senderPsid);

        // Check if the event is a message or postback and
        // pass the event to the appropriate handler function
        if (webhookEvent.postback) {

          await this.handlePostback(pageId, senderPsid, webhookEvent.postback);
        } else if (webhookEvent.message) {
          console.log("MESSAGE", webhookEvent.message.text);
          await fbService.sendOnTyping(pageId, senderPsid)
          await this.handleMessage(senderPsid, pageId, webhookEvent.message);
        }
      }

      // Iterates over each entry - there may be multiple if batched
      for (const entry of body.entry) {
        await handleEntry(entry)
      }
    } catch (error) {

    }
    return 'EVENT_RECEIVED';
  }

  private async handleMessage(
    senderPsid: string,
    pageId: string,
    receivedMessage: MessagingMessage,
  ) {
    let response = {}
    if (receivedMessage.text) {
       
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
        })).slice(0, 5).reverse() // limit 5 current chat
            
      if (receivedMessage.text) {
        const chatRes = await chatService.getMessage(pageId, senderPsid, historyMessages)
        response = chatRes
      }
      // response = { text: "Hi There" } // Need to Remove

    } else if (receivedMessage.attachments) {
      console.log("attachments: ", receivedMessage.attachments[0]);

      // Gets the URL of the message attachment
      let attachment_url = receivedMessage.attachments[0].payload.url;
      // Send unsupported method to user || send notification to admin for reply
    }
    await fbService.sendMessage(senderPsid, pageId, response);
  }

  private async handlePostback(pageId: string, senderPsid: string, postback: PostBack) {
    console.log(postback);
    switch (postback.payload) {
      case 'GET_STARTED':

        let { first_name, last_name } = await fbService.getFacebookUsername(senderPsid);
        let message1 = {
          text: `Xin chào ${last_name} ${first_name}. Tôi là chat bot có thể giúp bạn tìm việc làm nhanh chóng.`
        }
        let message2 = {
          text: `Đầu tiên hãy cho tôi biết bạn muốn tìm việc ở lĩnh vực nào?`
        }
        await fbService.sendOnTyping(pageId, senderPsid)
        await fbService.sendMessage(senderPsid, pageId, message1)

        await fbService.sendOnTyping(pageId, senderPsid)
        await fbService.sendMessage(senderPsid, pageId, message2)
        break;
    }
  }
}

const webhookService = new WebhookService();
export default webhookService

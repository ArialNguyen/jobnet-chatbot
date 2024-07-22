import chatService from "@/services/chatService";
import huspotConversationService from "@/services/huspotConversationService";


const GET = async (req: Request) => {
    return new Response("Nothing Here", {
        status: 200
    })
}

const POST = async (req: Request) => {
    const body = await new Response(req.body).json()
    const { objectId: threadId, changeFlag, attemptNumber } = body[0]

    if (changeFlag == "NEW_MESSAGE" && attemptNumber == 0) {
        console.log("Hubspot New Message: ", attemptNumber);

        const conversationRes = await huspotConversationService.getMessagesFromConversation(threadId)

        const messageFromAI = conversationRes.find((message: any) => (message["createdBy"] as string).includes("A-"))

        // Check if this message from Visitor
        // Check if this message is not the Creation Message
        // Check thread is AI chatbox
        if ((conversationRes[0]["createdBy"] as string).includes("V-") && messageFromAI !== undefined && messageFromAI["createdBy"] === process.env.HUBSPOT_AI_ACTOR_ID) { // If sender is Agent
            const conversation = conversationRes.map((con: any) => (
                ((con.createdBy as string).includes("A")) ? `[ASSISTANT] ${con.text}` : `[USER] ${con.text}`
            )).slice(0, 5).reverse()
            console.log("conversation:", conversation);
            await chatService.sendMessageFromAIHuspot(threadId, conversation)
        }
    }else if (changeFlag == 'CREATION') {
        // Nothing To do now.
    }
    return new Response("Message Sent!!!", {
        status: 200
    })
}


export { GET, POST }
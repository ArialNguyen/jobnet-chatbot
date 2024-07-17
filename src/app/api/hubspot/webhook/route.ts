import chatService from "@/services/chatService";
import huspotConversationService from "@/services/huspotConversationService";


const GET = async (req: Request) => {
    return new Response("Nothing Here", {
        status: 200
    })
}

const POST = async (req: Request) => {
    const body = await new Response(req.body).json()
    const { objectId: threadId, changeFlag } = body[0]

    if (changeFlag == "NEW_MESSAGE") {
        const conversationRes = await huspotConversationService.getMessagesFromConversation(threadId)

        if ((conversationRes[0].createdBy as string).includes("A-")) { // If sender is Agent
            return new Response("Nothing To Do", { status: 200 })
        }
        // Check thread is AI chatbox
        const senderActor = conversationRes.find((message: any) => (message.createdBy as string).includes("A-")).createdBy
        if (senderActor === process.env.HUBSPOT_AI_ACTOR_ID) {
            const conversation = conversationRes.map((con: any) => {
                return {
                    role: ((con.createdBy as string).includes("A")) ? "assistant" : "user",
                    content: con.text
                }
            })
            await chatService.sendMessageFromAIHuspot(threadId, conversation)
        }
    }
    if (changeFlag == 'CREATION') {
        // Nothing To do now.
    }

    return new Response("", {
        status: 200
    })
}


export { GET, POST }
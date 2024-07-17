import chatService from "@/services/chatService";
import huspotConversationService from "@/services/huspotConversationService";


const GET = async (req: Request) => {
    return new Response("Nothing here", {
        status: 200
    })
}

const POST = async (req: Request) => { // For Creation of conversation
    const body = await new Response(req.body).json()
    const { threadId, sender } = body

    const conversationRes = await huspotConversationService.getMessagesFromConversation(threadId)
    const conversation = conversationRes.map((con: any) => {
        return {
            role: ((con.createdBy as string).includes("A")) ? "assistant" : "user",
            content: con.text
        }
    })    
    if (conversation[0]["role"] !== "user") { // Dont need to check cause Conversation only created by Visitor
        return new Response("Creation only created by Visitor", {
            status: 400
        })
    }
    if (sender === "AI") {
        await chatService.sendMessageFromAIHuspot(threadId, conversation)
    } else {
        await chatService.sendMessageFromAssistantHuspot(threadId)
    }
    return new Response("", {
        status: 200
    })
}


export { GET, POST }
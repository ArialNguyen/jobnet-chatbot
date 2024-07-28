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

    const conversation = conversationRes.map((con: any) => (
        ((con.createdBy as string).includes("A")) ? `ASSISTANT: ${con.text}` : `USER: ${con.text}`
    )).slice(0, 5).reverse()
    console.log("Conversation Creation: ", conversation);

    if ((conversation[0] as string).includes("USER:")) { // Dont need to check cause Conversation only created by Visitor
        if (sender === "AI") {
            try {
                await chatService.sendMessageFromAIHubspot(threadId, conversation)
            } catch (error: any) {
                if (error.message == "WRONG_FORMAT_OLLAMA_RESPONE") {
                    await huspotConversationService.sendMessageFromAIByDefault({
                        threadId, text: "Oops, something wrong here. Please try again.", richText: "Oops, something wrong here. Please try again 😥😥😥"
                    })
                }
            }
        } else {
            await chatService.sendMessageFromAssistantHuspot(threadId)
        }
    }

    return new Response("", {
        status: 200
    })
}


export { GET, POST }
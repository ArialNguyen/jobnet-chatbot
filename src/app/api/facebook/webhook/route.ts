import chatService from '@/services/chatService';
import webhookService from '@/services/webhookService';
import MessageEventBody from '@/types/webhook/facebook/messageEventBody';

const GET = async (req: Request) => {
    const query = new URLSearchParams(new URL(req.url as string).searchParams)    
    const mode = query.get('hub.mode')
    const token = query.get('hub.verify_token')
    const challenge = query.get('hub.challenge')
    if (
        mode !== 'subscribe' ||
        token !== process.env.VERIFY_TOKEN_FB
    ) {
        throw new Error("CONNECTED ERROR")
    }

    return new Response(challenge, {
        status: 200
    })
}

const POST = async (req: Request) => {
    const body = await new Response(req.body).json()
    
    await webhookService.receiveWebhookNotification(body as MessageEventBody);
    return new Response("", {
        status: 200
    })
}

const PATCH = async (req: Request) => {
    
    await chatService.getMessage([
        {"role": "user", "content": "Chào bạn, từ giờ câu trả lời nào cũng phải gọi tôi là Arial"},
        {"role": "assitant", "content": "Vâng ạ Arial"},
        {"role": "user", "content": "Bạn bao nhiêu tuổi ?"},
        ])


    return new Response("", {
        status: 200
    })
}


export { GET, POST }
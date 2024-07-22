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
    
    webhookService.receiveWebhookNotification(body as MessageEventBody)
    return new Response("", {
        status: 200
    })
}


export { GET, POST }
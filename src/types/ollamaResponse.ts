import { MessagingMessage } from "@/types/webhook/facebook/messageEventBody";

export interface OllamaGenerateRes {
    model: string;
    created_at: string;
    response: string
    done: boolean;
    done_reason: string,
    context: number[]
}


export interface QuestionChatbotResponse {
    status: number,
    response: string
}